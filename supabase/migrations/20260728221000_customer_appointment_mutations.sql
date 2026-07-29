set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function private.compute_customer_reschedule_slots(
  p_appointment_id uuid,
  p_start_date date,
  p_end_date date,
  p_now timestamptz
)
returns table (
  local_date date,
  start_at timestamptz,
  end_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  with appointment_context as (
    select
      appointment.id as appointment_id,
      appointment.provider_id,
      appointment.duration_minutes_snapshot as duration_minutes,
      appointment.buffer_before_minutes_snapshot as buffer_before_minutes,
      appointment.buffer_after_minutes_snapshot as buffer_after_minutes,
      settings.minimum_notice_minutes,
      settings.slot_granularity_minutes
    from public.appointments as appointment
    cross join public.site_settings as settings
    where appointment.id = p_appointment_id
      and appointment.status = 'confirmed'::public.appointment_status
      and appointment.management_token_revoked_at is null
      and settings.singleton
  ),
  requested_days as (
    select requested_day::date as local_date
    from pg_catalog.generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      interval '1 day'
    ) as days(requested_day)
  ),
  effective_windows as (
    select
      requested.local_date,
      context.*,
      case
        when schedule_override.id is not null then schedule_override.start_time
        else hours.start_time
      end as start_time,
      case
        when schedule_override.id is not null then schedule_override.end_time
        else hours.end_time
      end as end_time
    from requested_days as requested
    cross join appointment_context as context
    left join public.schedule_exceptions as schedule_override
      on schedule_override.provider_id = context.provider_id
      and schedule_override.local_date = requested.local_date
    left join public.business_hours as hours
      on hours.provider_id = context.provider_id
      and hours.weekday = extract(dow from requested.local_date)::smallint
    where (
      schedule_override.id is not null
      and schedule_override.exception_type
        <> 'closed'::public.schedule_exception_type
    )
    or (
      schedule_override.id is null
      and coalesce(hours.is_open, false)
    )
  ),
  bounded_windows as (
    select
      effective_window.*,
      (
        effective_window.local_date + effective_window.start_time
      ) at time zone 'Europe/Istanbul' as window_start_at,
      (
        effective_window.local_date + effective_window.end_time
      ) at time zone 'Europe/Istanbul' as window_end_at
    from effective_windows as effective_window
    where effective_window.start_time is not null
      and effective_window.end_time is not null
      and effective_window.start_time < effective_window.end_time
  ),
  candidates as (
    select
      schedule_window.appointment_id,
      schedule_window.provider_id,
      schedule_window.local_date,
      candidate.start_at,
      candidate.start_at
        + schedule_window.duration_minutes * interval '1 minute' as end_at,
      candidate.start_at
        - schedule_window.buffer_before_minutes * interval '1 minute'
        as occupied_start_at,
      candidate.start_at
        + (
          schedule_window.duration_minutes
          + schedule_window.buffer_after_minutes
        ) * interval '1 minute' as occupied_end_at,
      schedule_window.window_start_at,
      schedule_window.window_end_at
    from bounded_windows as schedule_window
    cross join lateral pg_catalog.generate_series(
      schedule_window.window_start_at,
      schedule_window.window_end_at,
      pg_catalog.make_interval(
        mins => schedule_window.slot_granularity_minutes
      )
    ) as candidate(start_at)
    where candidate.start_at
      >= p_now
        + schedule_window.minimum_notice_minutes * interval '1 minute'
  )
  select
    candidate.local_date,
    candidate.start_at,
    candidate.end_at
  from candidates as candidate
  where candidate.occupied_start_at >= candidate.window_start_at
    and candidate.occupied_end_at <= candidate.window_end_at
    and not exists (
      select 1
      from public.availability_blocks as block
      where block.provider_id = candidate.provider_id
        and block.blocked_range && tstzrange(
          candidate.occupied_start_at,
          candidate.occupied_end_at,
          '[)'
        )
    )
    and not exists (
      select 1
      from public.appointments as appointment
      where appointment.provider_id = candidate.provider_id
        and appointment.id <> candidate.appointment_id
        and appointment.status = 'confirmed'::public.appointment_status
        and appointment.occupied_range && tstzrange(
          candidate.occupied_start_at,
          candidate.occupied_end_at,
          '[)'
        )
    )
  order by candidate.start_at;
$$;

revoke all on function private.compute_customer_reschedule_slots(
  uuid,
  date,
  date,
  timestamptz
) from public, anon, authenticated, service_role;

drop function public.get_appointment_access_session(text, text);

create or replace function public.get_appointment_access_session(
  p_session_hash text,
  p_required_scope text
)
returns table (
  appointment_id uuid,
  access_scope text,
  booking_code text,
  appointment_status text,
  service_id uuid,
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
  maximum_booking_days integer,
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
    v_appointment.service_id,
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
    least(v_settings.maximum_booking_days, 60),
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

create or replace function public.get_customer_reschedule_availability(
  p_session_hash text,
  p_start_date date,
  p_end_date date
)
returns table (
  local_date date,
  start_at timestamptz,
  end_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'Europe/Istanbul')::date;
  v_session private.appointment_access_sessions%rowtype;
  v_appointment public.appointments%rowtype;
  v_settings public.site_settings%rowtype;
  v_refreshed_sliding_expiry timestamptz;
begin
  if p_session_hash is null
    or p_session_hash !~ '^[0-9a-f]{64}$'
    or p_start_date is null
    or p_end_date is null
    or not isfinite(p_start_date)
    or not isfinite(p_end_date)
    or p_start_date > p_end_date
    or p_end_date - p_start_date > 59
  then
    raise exception 'reschedule_availability_request_invalid'
      using errcode = '22023';
  end if;

  select access_session.*
    into v_session
  from private.appointment_access_sessions as access_session
  where access_session.session_hash = p_session_hash
    and access_session.scope = 'appointment_manage'
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
  where appointment.id = v_session.appointment_id
    and appointment.status = 'confirmed'
    and appointment.management_token_revoked_at is null;

  if not found then
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

  if v_now
    >= v_appointment.start_at
      - v_settings.reschedule_deadline_minutes * interval '1 minute'
  then
    raise exception 'reschedule_deadline_passed'
      using errcode = 'P0001';
  end if;

  if p_start_date < v_today
    or p_end_date
      > v_today + least(v_settings.maximum_booking_days, 60)
  then
    raise exception 'reschedule_date_outside_policy'
      using errcode = '22023';
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
  select slot.local_date, slot.start_at, slot.end_at
  from private.compute_customer_reschedule_slots(
    v_appointment.id,
    p_start_date,
    p_end_date,
    v_now
  ) as slot;
end;
$$;

revoke all on function public.get_customer_reschedule_availability(
  text,
  date,
  date
) from public, anon, authenticated, service_role;
grant execute on function public.get_customer_reschedule_availability(
  text,
  date,
  date
) to service_role;

create or replace function public.reschedule_customer_appointment(
  p_session_hash text,
  p_new_start_at timestamptz,
  p_expected_row_version bigint,
  p_idempotency_key_hmac text,
  p_request_fingerprint text,
  p_request_id uuid
)
returns table (
  appointment_status text,
  appointment_start_at timestamptz,
  appointment_end_at timestamptz,
  result_row_version bigint,
  can_cancel boolean,
  can_reschedule boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'Europe/Istanbul')::date;
  v_idempotency_inserted integer;
  v_idempotency private.idempotency_keys%rowtype;
  v_session private.appointment_access_sessions%rowtype;
  v_appointment public.appointments%rowtype;
  v_settings public.site_settings%rowtype;
  v_provider_id uuid;
  v_appointment_id uuid;
  v_duration_minutes integer;
  v_buffer_before_minutes integer;
  v_buffer_after_minutes integer;
  v_old_occupied_start_at timestamptz;
  v_old_occupied_end_at timestamptz;
  v_new_end_at timestamptz;
  v_new_occupied_start_at timestamptz;
  v_new_occupied_end_at timestamptz;
  v_new_local_date date;
  v_result_payload jsonb;
begin
  if p_session_hash is null
    or p_session_hash !~ '^[0-9a-f]{64}$'
    or p_new_start_at is null
    or not isfinite(p_new_start_at)
    or p_expected_row_version is null
    or p_expected_row_version < 0
    or p_idempotency_key_hmac is null
    or p_idempotency_key_hmac !~ '^[0-9a-f]{64}$'
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_request_id is null
  then
    raise exception 'reschedule_request_invalid'
      using errcode = '22023';
  end if;

  delete from private.idempotency_keys as idempotency
  where idempotency.scope = 'customer_reschedule'
    and idempotency.key_hmac = p_idempotency_key_hmac
    and idempotency.expires_at <= v_now;

  insert into private.idempotency_keys (
    scope,
    key_hmac,
    request_fingerprint,
    expires_at
  )
  values (
    'customer_reschedule',
    p_idempotency_key_hmac,
    p_request_fingerprint,
    v_now + interval '24 hours'
  )
  on conflict (scope, key_hmac) do nothing;

  get diagnostics v_idempotency_inserted = row_count;

  if v_idempotency_inserted = 0 then
    select idempotency.*
      into v_idempotency
    from private.idempotency_keys as idempotency
    where idempotency.scope = 'customer_reschedule'
      and idempotency.key_hmac = p_idempotency_key_hmac;

    if v_idempotency.request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'idempotency_key_reuse'
        using errcode = '22023';
    end if;

    if v_idempotency.result_appointment_id is null then
      raise exception 'idempotency_result_unavailable'
        using errcode = '40001';
    end if;

    select appointment.*
      into v_appointment
    from public.appointments as appointment
    where appointment.id = v_idempotency.result_appointment_id;

    if not found then
      raise exception 'idempotency_result_unavailable'
        using errcode = '40001';
    end if;

    select settings.*
      into v_settings
    from public.site_settings as settings
    where settings.singleton;

    return query
    select
      v_appointment.status::text,
      v_appointment.start_at,
      v_appointment.end_at,
      v_appointment.row_version,
      v_appointment.status = 'confirmed'
        and v_now
          < v_appointment.start_at
            - v_settings.cancellation_deadline_minutes * interval '1 minute',
      v_appointment.status = 'confirmed'
        and v_now
          < v_appointment.start_at
            - v_settings.reschedule_deadline_minutes * interval '1 minute';
    return;
  end if;

  select
    access_session.appointment_id,
    appointment.provider_id,
    appointment.duration_minutes_snapshot,
    appointment.buffer_before_minutes_snapshot,
    appointment.buffer_after_minutes_snapshot,
    appointment.occupied_start_at,
    appointment.occupied_end_at
  into
    v_appointment_id,
    v_provider_id,
    v_duration_minutes,
    v_buffer_before_minutes,
    v_buffer_after_minutes,
    v_old_occupied_start_at,
    v_old_occupied_end_at
  from private.appointment_access_sessions as access_session
  join public.appointments as appointment
    on appointment.id = access_session.appointment_id
  where access_session.session_hash = p_session_hash
    and access_session.scope = 'appointment_manage'
    and access_session.revoked_at is null
    and access_session.sliding_expires_at > v_now
    and access_session.absolute_expires_at > v_now
    and appointment.status = 'confirmed'
    and appointment.management_token_revoked_at is null;

  if not found then
    raise exception 'appointment_session_invalid'
      using errcode = 'P0001';
  end if;

  v_new_end_at := p_new_start_at
    + v_duration_minutes * interval '1 minute';
  v_new_occupied_start_at := p_new_start_at
    - v_buffer_before_minutes * interval '1 minute';
  v_new_occupied_end_at := v_new_end_at
    + v_buffer_after_minutes * interval '1 minute';
  v_new_local_date := (p_new_start_at at time zone 'Europe/Istanbul')::date;

  perform private.lock_provider_schedule_shared(v_provider_id);
  perform private.lock_provider_dates(
    v_provider_id,
    private.local_dates_for_range(
      v_old_occupied_start_at,
      v_old_occupied_end_at
    )
      || private.local_dates_for_range(
        v_new_occupied_start_at,
        v_new_occupied_end_at
      )
  );

  select access_session.*
    into v_session
  from private.appointment_access_sessions as access_session
  where access_session.session_hash = p_session_hash
    and access_session.scope = 'appointment_manage'
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
  where appointment.id = v_session.appointment_id
  for update;

  if not found
    or v_appointment.id <> v_appointment_id
    or v_appointment.provider_id <> v_provider_id
    or v_appointment.status <> 'confirmed'
    or v_appointment.management_token_revoked_at is not null
  then
    raise exception 'appointment_session_invalid'
      using errcode = 'P0001';
  end if;

  if v_appointment.row_version <> p_expected_row_version then
    raise exception 'stale_appointment'
      using errcode = '40001';
  end if;

  if p_new_start_at = v_appointment.start_at then
    raise exception 'appointment_time_unchanged'
      using errcode = '22023';
  end if;

  select settings.*
    into v_settings
  from public.site_settings as settings
  where settings.singleton
  for share;

  if not found then
    raise exception 'booking_configuration_unavailable'
      using errcode = 'P0001';
  end if;

  if v_now
    >= v_appointment.start_at
      - v_settings.reschedule_deadline_minutes * interval '1 minute'
  then
    raise exception 'reschedule_deadline_passed'
      using errcode = 'P0001';
  end if;

  if v_new_local_date < v_today
    or v_new_local_date
      > v_today + least(v_settings.maximum_booking_days, 60)
  then
    raise exception 'reschedule_date_outside_policy'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from private.compute_customer_reschedule_slots(
      v_appointment.id,
      v_new_local_date,
      v_new_local_date,
      v_now
    ) as slot
    where slot.start_at = p_new_start_at
  )
  then
    raise exception 'slot_unavailable'
      using errcode = 'P0001';
  end if;

  update public.appointments as appointment
  set
    start_at = p_new_start_at,
    end_at = v_new_end_at,
    occupied_start_at = v_new_occupied_start_at,
    occupied_end_at = v_new_occupied_end_at,
    receipt_token_expires_at = greatest(
      appointment.receipt_token_expires_at,
      v_now + v_settings.receipt_token_lifetime_minutes * interval '1 minute'
    ),
    management_token_expires_at = greatest(
      appointment.management_token_expires_at,
      v_now + v_settings.management_token_lifetime_minutes * interval '1 minute'
    )
  where appointment.id = v_appointment.id
    and appointment.row_version = p_expected_row_version
    and appointment.status = 'confirmed'
  returning appointment.* into v_appointment;

  if not found then
    raise exception 'stale_appointment'
      using errcode = '40001';
  end if;

  update private.appointment_access_sessions as access_session
  set
    last_seen_at = v_now,
    sliding_expires_at = least(
      v_now + interval '30 minutes',
      access_session.absolute_expires_at
    )
  where access_session.session_hash = p_session_hash;

  insert into private.admin_notifications (
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    'booking_rescheduled',
    'appointment',
    v_appointment.id::text,
    'Randevu tarihi değiştirildi',
    v_appointment.service_name_snapshot
      || ' - '
      || pg_catalog.to_char(
        v_appointment.start_at at time zone 'Europe/Istanbul',
        'YYYY-MM-DD HH24:MI'
      )
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
    'appointment.rescheduled',
    'appointment',
    v_appointment.id::text,
    pg_catalog.jsonb_build_object(
      'local_date',
      v_new_local_date,
      'row_version',
      v_appointment.row_version
    ),
    p_request_id
  );

  v_result_payload := pg_catalog.jsonb_build_object(
    'status',
    v_appointment.status::text,
    'start_at',
    v_appointment.start_at,
    'end_at',
    v_appointment.end_at,
    'row_version',
    v_appointment.row_version
  );

  update private.idempotency_keys as idempotency
  set
    result_appointment_id = v_appointment.id,
    result_management_token_version = v_appointment.management_token_version,
    result_payload = v_result_payload
  where idempotency.scope = 'customer_reschedule'
    and idempotency.key_hmac = p_idempotency_key_hmac;

  return query
  select
    v_appointment.status::text,
    v_appointment.start_at,
    v_appointment.end_at,
    v_appointment.row_version,
    v_now
      < v_appointment.start_at
        - v_settings.cancellation_deadline_minutes * interval '1 minute',
    v_now
      < v_appointment.start_at
        - v_settings.reschedule_deadline_minutes * interval '1 minute';
end;
$$;

revoke all on function public.reschedule_customer_appointment(
  text,
  timestamptz,
  bigint,
  text,
  text,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.reschedule_customer_appointment(
  text,
  timestamptz,
  bigint,
  text,
  text,
  uuid
) to service_role;

create or replace function public.cancel_customer_appointment(
  p_session_hash text,
  p_expected_row_version bigint,
  p_cancellation_reason text,
  p_idempotency_key_hmac text,
  p_request_fingerprint text,
  p_request_id uuid
)
returns table (
  appointment_status text,
  appointment_start_at timestamptz,
  appointment_end_at timestamptz,
  result_row_version bigint,
  cancelled_at timestamptz,
  can_cancel boolean,
  can_reschedule boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_reason text := nullif(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(coalesce(p_cancellation_reason, '')),
      '\s+',
      ' ',
      'g'
    ),
    ''
  );
  v_idempotency_inserted integer;
  v_idempotency private.idempotency_keys%rowtype;
  v_session private.appointment_access_sessions%rowtype;
  v_appointment public.appointments%rowtype;
  v_settings public.site_settings%rowtype;
  v_result_payload jsonb;
begin
  v_reason := coalesce(v_reason, 'Müşteri tarafından online iptal edildi');

  if p_session_hash is null
    or p_session_hash !~ '^[0-9a-f]{64}$'
    or p_expected_row_version is null
    or p_expected_row_version < 0
    or char_length(v_reason) not between 2 and 1000
    or p_idempotency_key_hmac is null
    or p_idempotency_key_hmac !~ '^[0-9a-f]{64}$'
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_request_id is null
  then
    raise exception 'cancellation_request_invalid'
      using errcode = '22023';
  end if;

  delete from private.idempotency_keys as idempotency
  where idempotency.scope = 'customer_cancellation'
    and idempotency.key_hmac = p_idempotency_key_hmac
    and idempotency.expires_at <= v_now;

  insert into private.idempotency_keys (
    scope,
    key_hmac,
    request_fingerprint,
    expires_at
  )
  values (
    'customer_cancellation',
    p_idempotency_key_hmac,
    p_request_fingerprint,
    v_now + interval '24 hours'
  )
  on conflict (scope, key_hmac) do nothing;

  get diagnostics v_idempotency_inserted = row_count;

  if v_idempotency_inserted = 0 then
    select idempotency.*
      into v_idempotency
    from private.idempotency_keys as idempotency
    where idempotency.scope = 'customer_cancellation'
      and idempotency.key_hmac = p_idempotency_key_hmac;

    if v_idempotency.request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'idempotency_key_reuse'
        using errcode = '22023';
    end if;

    if v_idempotency.result_appointment_id is null then
      raise exception 'idempotency_result_unavailable'
        using errcode = '40001';
    end if;

    select appointment.*
      into v_appointment
    from public.appointments as appointment
    where appointment.id = v_idempotency.result_appointment_id;

    if not found then
      raise exception 'idempotency_result_unavailable'
        using errcode = '40001';
    end if;

    return query
    select
      v_appointment.status::text,
      v_appointment.start_at,
      v_appointment.end_at,
      v_appointment.row_version,
      v_appointment.cancelled_at,
      false,
      false;
    return;
  end if;

  select access_session.*
    into v_session
  from private.appointment_access_sessions as access_session
  where access_session.session_hash = p_session_hash
    and access_session.scope = 'appointment_manage'
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
  where appointment.id = v_session.appointment_id
  for update;

  if not found
    or v_appointment.status <> 'confirmed'
    or v_appointment.management_token_revoked_at is not null
  then
    raise exception 'appointment_session_invalid'
      using errcode = 'P0001';
  end if;

  if v_appointment.row_version <> p_expected_row_version then
    raise exception 'stale_appointment'
      using errcode = '40001';
  end if;

  select settings.*
    into v_settings
  from public.site_settings as settings
  where settings.singleton
  for share;

  if not found then
    raise exception 'booking_configuration_unavailable'
      using errcode = 'P0001';
  end if;

  if v_now
    >= v_appointment.start_at
      - v_settings.cancellation_deadline_minutes * interval '1 minute'
  then
    raise exception 'cancellation_deadline_passed'
      using errcode = 'P0001';
  end if;

  update public.appointments as appointment
  set
    status = 'cancelled',
    cancellation_reason = v_reason,
    cancelled_at = v_now,
    management_token_revoked_at = v_now
  where appointment.id = v_appointment.id
    and appointment.row_version = p_expected_row_version
    and appointment.status = 'confirmed'
  returning appointment.* into v_appointment;

  if not found then
    raise exception 'stale_appointment'
      using errcode = '40001';
  end if;

  update private.appointment_access_sessions as access_session
  set revoked_at = coalesce(access_session.revoked_at, v_now)
  where access_session.appointment_id = v_appointment.id
    and access_session.scope = 'appointment_manage'
    and access_session.revoked_at is null;

  insert into private.admin_notifications (
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    'booking_cancelled',
    'appointment',
    v_appointment.id::text,
    'Randevu iptal edildi',
    v_appointment.service_name_snapshot
      || ' - '
      || pg_catalog.to_char(
        v_appointment.start_at at time zone 'Europe/Istanbul',
        'YYYY-MM-DD HH24:MI'
      )
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
    'appointment.cancelled',
    'appointment',
    v_appointment.id::text,
    pg_catalog.jsonb_build_object(
      'source',
      'appointment_manage',
      'row_version',
      v_appointment.row_version
    ),
    p_request_id
  );

  v_result_payload := pg_catalog.jsonb_build_object(
    'status',
    v_appointment.status::text,
    'start_at',
    v_appointment.start_at,
    'end_at',
    v_appointment.end_at,
    'row_version',
    v_appointment.row_version,
    'cancelled_at',
    v_appointment.cancelled_at
  );

  update private.idempotency_keys as idempotency
  set
    result_appointment_id = v_appointment.id,
    result_management_token_version = v_appointment.management_token_version,
    result_payload = v_result_payload
  where idempotency.scope = 'customer_cancellation'
    and idempotency.key_hmac = p_idempotency_key_hmac;

  return query
  select
    v_appointment.status::text,
    v_appointment.start_at,
    v_appointment.end_at,
    v_appointment.row_version,
    v_appointment.cancelled_at,
    false,
    false;
end;
$$;

revoke all on function public.cancel_customer_appointment(
  text,
  bigint,
  text,
  text,
  text,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.cancel_customer_appointment(
  text,
  bigint,
  text,
  text,
  text,
  uuid
) to service_role;
