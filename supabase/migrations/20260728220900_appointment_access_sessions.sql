set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.exchange_appointment_access_token(
  p_token_hash text,
  p_scope text,
  p_session_hash text,
  p_request_id uuid
)
returns table (
  appointment_id uuid,
  access_scope text,
  sliding_expires_at timestamptz,
  absolute_expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_appointment public.appointments%rowtype;
  v_sliding_expires_at timestamptz;
  v_absolute_expires_at timestamptz;
begin
  if p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_session_hash is null
    or p_session_hash !~ '^[0-9a-f]{64}$'
    or p_scope not in ('receipt_read', 'appointment_manage')
    or p_request_id is null
  then
    raise exception 'appointment_access_request_invalid'
      using errcode = '22023';
  end if;

  if p_scope = 'receipt_read' then
    select appointment.*
      into v_appointment
    from public.appointments as appointment
    where appointment.receipt_token_hash = p_token_hash
      and appointment.receipt_token_revoked_at is null
      and appointment.receipt_token_expires_at > v_now
    for update;
  else
    select appointment.*
      into v_appointment
    from public.appointments as appointment
    where appointment.management_token_hash = p_token_hash
      and appointment.management_token_revoked_at is null
      and appointment.management_token_expires_at > v_now
      and appointment.status = 'confirmed'
    for update;
  end if;

  if not found then
    raise exception 'appointment_link_invalid'
      using errcode = 'P0001';
  end if;

  v_absolute_expires_at := v_now + interval '2 hours';
  v_sliding_expires_at := v_now + interval '30 minutes';

  insert into private.appointment_access_sessions (
    session_hash,
    appointment_id,
    scope,
    created_at,
    last_seen_at,
    sliding_expires_at,
    absolute_expires_at
  )
  values (
    p_session_hash,
    v_appointment.id,
    p_scope::private.appointment_access_scope,
    v_now,
    v_now,
    v_sliding_expires_at,
    v_absolute_expires_at
  );

  insert into private.audit_logs (
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    'customer',
    'appointment.access_link_exchanged',
    'appointment',
    v_appointment.id::text,
    pg_catalog.jsonb_build_object('scope', p_scope),
    p_request_id
  );

  return query
  select
    v_appointment.id,
    p_scope,
    v_sliding_expires_at,
    v_absolute_expires_at;
end;
$$;

revoke all on function public.exchange_appointment_access_token(
  text,
  text,
  text,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.exchange_appointment_access_token(
  text,
  text,
  text,
  uuid
) to service_role;

create or replace function public.get_appointment_access_session(
  p_session_hash text,
  p_required_scope text
)
returns table (
  appointment_id uuid,
  access_scope text,
  booking_code text,
  appointment_status text,
  service_name text,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes integer,
  quoted_price numeric,
  price_type text,
  currency text,
  row_version bigint,
  business_name text,
  address text,
  map_url text,
  phone_e164 text,
  whatsapp_e164 text,
  can_cancel boolean,
  can_reschedule boolean,
  session_expires_at timestamptz,
  session_absolute_expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session private.appointment_access_sessions%rowtype;
  v_appointment public.appointments%rowtype;
  v_settings public.site_settings%rowtype;
  v_refreshed_sliding_expiry timestamptz;
begin
  if p_session_hash is null
    or p_session_hash !~ '^[0-9a-f]{64}$'
    or p_required_scope not in ('receipt_read', 'appointment_manage')
  then
    raise exception 'appointment_access_request_invalid'
      using errcode = '22023';
  end if;

  select access_session.*
    into v_session
  from private.appointment_access_sessions as access_session
  where access_session.session_hash = p_session_hash
    and access_session.scope = p_required_scope::private.appointment_access_scope
  for update;

  if not found
    or v_session.revoked_at is not null
    or v_session.sliding_expires_at <= v_now
    or v_session.absolute_expires_at <= v_now
  then
    raise exception 'appointment_session_invalid'
      using errcode = 'P0001';
  end if;

  select appointment.*
    into v_appointment
  from public.appointments as appointment
  where appointment.id = v_session.appointment_id;

  if not found then
    raise exception 'appointment_session_invalid'
      using errcode = 'P0001';
  end if;

  if p_required_scope = 'receipt_read' then
    if v_appointment.receipt_token_revoked_at is not null then
      raise exception 'appointment_session_invalid'
        using errcode = 'P0001';
    end if;
  elsif v_appointment.management_token_revoked_at is not null
    or v_appointment.status <> 'confirmed'
  then
    raise exception 'appointment_session_invalid'
      using errcode = 'P0001';
  end if;

  select settings.*
    into v_settings
  from public.site_settings as settings
  where settings.singleton;

  if not found then
    raise exception 'booking_configuration_unavailable'
      using errcode = 'P0001';
  end if;

  v_refreshed_sliding_expiry := least(
    v_now + interval '30 minutes',
    v_session.absolute_expires_at
  );

  update private.appointment_access_sessions as access_session
  set
    last_seen_at = v_now,
    sliding_expires_at = v_refreshed_sliding_expiry
  where access_session.session_hash = v_session.session_hash;

  return query
  select
    v_appointment.id,
    p_required_scope,
    v_appointment.booking_code,
    v_appointment.status::text,
    v_appointment.service_name_snapshot,
    v_appointment.start_at,
    v_appointment.end_at,
    v_appointment.duration_minutes_snapshot,
    v_appointment.quoted_price,
    v_appointment.price_type_snapshot::text,
    v_appointment.currency,
    v_appointment.row_version,
    v_settings.business_name,
    v_settings.address,
    v_settings.map_url,
    v_settings.phone_e164,
    v_settings.whatsapp_e164,
    p_required_scope = 'appointment_manage'
      and v_appointment.status = 'confirmed'
      and v_now
        < v_appointment.start_at
          - v_settings.cancellation_deadline_minutes * interval '1 minute',
    p_required_scope = 'appointment_manage'
      and v_appointment.status = 'confirmed'
      and v_now
        < v_appointment.start_at
          - v_settings.reschedule_deadline_minutes * interval '1 minute',
    v_refreshed_sliding_expiry,
    v_session.absolute_expires_at;
end;
$$;

revoke all on function public.get_appointment_access_session(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_appointment_access_session(text, text)
  to service_role;
