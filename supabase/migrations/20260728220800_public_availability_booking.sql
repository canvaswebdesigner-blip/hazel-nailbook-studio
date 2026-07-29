set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function private.compute_available_slots(
  p_provider_id uuid,
  p_service_id uuid,
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
  with requested_days as (
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
      case
        when schedule_override.id is not null then schedule_override.start_time
        else hours.start_time
      end as start_time,
      case
        when schedule_override.id is not null then schedule_override.end_time
        else hours.end_time
      end as end_time
    from requested_days as requested
    left join public.schedule_exceptions as schedule_override
      on schedule_override.provider_id = p_provider_id
      and schedule_override.local_date = requested.local_date
    left join public.business_hours as hours
      on hours.provider_id = p_provider_id
      and hours.weekday = extract(
        dow from requested.local_date
      )::smallint
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
      effective_window.local_date,
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
  slot_context as (
    select
      service.duration_minutes,
      service.buffer_before_minutes,
      service.buffer_after_minutes,
      settings.minimum_notice_minutes,
      settings.slot_granularity_minutes
    from public.services as service
    cross join public.site_settings as settings
    where service.id = p_service_id
      and service.is_active
      and service.is_bookable
      and settings.singleton
      and not settings.booking_disabled
  ),
  candidates as (
    select
      schedule_window.local_date,
      candidate.start_at,
      candidate.start_at
        + context.duration_minutes * interval '1 minute' as end_at,
      candidate.start_at
        - context.buffer_before_minutes * interval '1 minute'
        as occupied_start_at,
      candidate.start_at
        + (
          context.duration_minutes + context.buffer_after_minutes
        ) * interval '1 minute' as occupied_end_at,
      schedule_window.window_start_at,
      schedule_window.window_end_at
    from bounded_windows as schedule_window
    cross join slot_context as context
    cross join lateral pg_catalog.generate_series(
      schedule_window.window_start_at,
      schedule_window.window_end_at,
      pg_catalog.make_interval(mins => context.slot_granularity_minutes)
    ) as candidate(start_at)
    where candidate.start_at
      >= p_now + context.minimum_notice_minutes * interval '1 minute'
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
      where block.provider_id = p_provider_id
        and block.blocked_range && tstzrange(
          candidate.occupied_start_at,
          candidate.occupied_end_at,
          '[)'
        )
    )
    and not exists (
      select 1
      from public.appointments as appointment
      where appointment.provider_id = p_provider_id
        and appointment.status = 'confirmed'::public.appointment_status
        and appointment.occupied_range && tstzrange(
          candidate.occupied_start_at,
          candidate.occupied_end_at,
          '[)'
        )
    )
  order by candidate.start_at;
$$;

revoke all on function private.compute_available_slots(
  uuid,
  uuid,
  date,
  date,
  timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.get_public_availability(
  p_service_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  local_date date,
  start_at timestamptz,
  end_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_provider_id uuid;
  v_today date := (
    statement_timestamp() at time zone 'Europe/Istanbul'
  )::date;
  v_maximum_booking_days integer;
  v_booking_disabled boolean;
begin
  if p_service_id is null
    or p_start_date is null
    or p_end_date is null
    or not isfinite(p_start_date)
    or not isfinite(p_end_date)
    or p_start_date > p_end_date
  then
    raise exception 'availability_range_invalid'
      using errcode = '22023';
  end if;

  select
    settings.maximum_booking_days,
    settings.booking_disabled
    into
      v_maximum_booking_days,
      v_booking_disabled
  from public.site_settings as settings
  where settings.singleton;

  if not found then
    raise exception 'booking_configuration_unavailable'
      using errcode = 'P0001';
  end if;

  if p_start_date < v_today
    or p_end_date > v_today + least(v_maximum_booking_days, 60)
  then
    raise exception 'availability_range_outside_policy'
      using errcode = '22023';
  end if;

  if p_end_date - p_start_date > 59 then
    raise exception 'availability_range_invalid'
      using errcode = '22023';
  end if;

  if v_booking_disabled then
    raise exception 'booking_disabled'
      using errcode = 'P0001';
  end if;

  select provider.id
    into v_provider_id
  from public.providers as provider
  where provider.is_active;

  if not found then
    raise exception 'booking_provider_unavailable'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.services as service
    where service.id = p_service_id
      and service.is_active
      and service.is_bookable
  ) then
    raise exception 'service_unavailable'
      using errcode = 'P0001';
  end if;

  return query
  select
    slot.local_date,
    slot.start_at,
    slot.end_at
  from private.compute_available_slots(
    v_provider_id,
    p_service_id,
    p_start_date,
    p_end_date,
    statement_timestamp()
  ) as slot;
end;
$$;

revoke all on function public.get_public_availability(uuid, date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_availability(uuid, date, date)
  to service_role;

create or replace function public.consume_public_rate_limit(
  p_scope text,
  p_bucket_hmac text,
  p_window_seconds integer,
  p_request_limit integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_window_start timestamptz;
  v_request_count integer;
  v_expires_at timestamptz;
begin
  if p_scope is null
    or p_scope !~ '^[a-z][a-z0-9_]{1,79}$'
    or p_bucket_hmac is null
    or p_bucket_hmac !~ '^[0-9a-f]{64}$'
    or p_window_seconds is null
    or p_window_seconds not between 1 and 86400
    or p_request_limit is null
    or p_request_limit not between 1 and 100000
  then
    raise exception 'rate_limit_request_invalid'
      using errcode = '22023';
  end if;

  v_window_start := pg_catalog.to_timestamp(
    (
      pg_catalog.floor(
        extract(epoch from v_now) / p_window_seconds
      ) * p_window_seconds
    )::double precision
  );
  v_expires_at := v_window_start
    + p_window_seconds * interval '1 second';

  insert into private.rate_limit_counters as counter (
    scope,
    bucket_hmac,
    window_start,
    window_seconds,
    request_count,
    expires_at
  )
  values (
    p_scope,
    p_bucket_hmac,
    v_window_start,
    p_window_seconds,
    1,
    v_expires_at
  )
  on conflict (scope, bucket_hmac, window_start) do update
  set request_count = counter.request_count + 1
  where counter.window_seconds = excluded.window_seconds
  returning
    counter.request_count,
    counter.expires_at
    into
      v_request_count,
      v_expires_at;

  if not found then
    raise exception 'rate_limit_window_mismatch'
      using errcode = '22023';
  end if;

  return query
  select
    v_request_count <= p_request_limit,
    greatest(p_request_limit - v_request_count, 0),
    case
      when v_request_count <= p_request_limit then 0
      else greatest(
        pg_catalog.ceil(
          extract(epoch from (v_expires_at - v_now))
        )::integer,
        1
      )
    end;
end;
$$;

revoke all on function public.consume_public_rate_limit(
  text,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;
grant execute on function public.consume_public_rate_limit(
  text,
  text,
  integer,
  integer
) to service_role;

create or replace function public.create_public_booking(
  p_appointment_id uuid,
  p_service_id uuid,
  p_start_at timestamptz,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_customer_note text,
  p_booking_code text,
  p_token_key_version integer,
  p_receipt_token_hash text,
  p_management_token_hash text,
  p_privacy_notice_version text,
  p_booking_terms_version text,
  p_consent_ip_hmac text,
  p_idempotency_key_hmac text,
  p_request_fingerprint text,
  p_request_id uuid
)
returns table (
  result_kind text,
  appointment_id uuid,
  booking_code text,
  appointment_status text,
  appointment_start_at timestamptz,
  appointment_end_at timestamptz,
  service_name text,
  quoted_price numeric,
  price_type text,
  currency text,
  token_key_version integer,
  management_token_version integer,
  duration_minutes integer,
  receipt_expires_at timestamptz,
  management_expires_at timestamptz,
  private_link_reissuable boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'Europe/Istanbul')::date;
  v_local_date date;
  v_provider_id uuid;
  v_customer_id uuid;
  v_privacy_notice_id uuid;
  v_booking_terms_id uuid;
  v_idempotency_inserted integer;
  v_idempotency private.idempotency_keys%rowtype;
  v_settings public.site_settings%rowtype;
  v_service public.services%rowtype;
  v_appointment public.appointments%rowtype;
  v_end_at timestamptz;
  v_occupied_start_at timestamptz;
  v_occupied_end_at timestamptz;
  v_lock_dates date[];
  v_result_payload jsonb;
  v_normalized_name text;
  v_normalized_email text;
  v_normalized_note text;
begin
  v_normalized_name := pg_catalog.btrim(p_full_name);
  v_normalized_email := nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
  v_normalized_note := nullif(pg_catalog.btrim(p_customer_note), '');

  if p_appointment_id is null
    or p_service_id is null
    or p_start_at is null
    or not isfinite(p_start_at)
    or p_request_id is null
    or v_normalized_name is null
    or char_length(v_normalized_name) not between 2 and 100
    or p_phone_e164 is null
    or p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$'
    or (
      v_normalized_email is not null
      and char_length(v_normalized_email) not between 3 and 320
    )
    or (
      v_normalized_note is not null
      and char_length(v_normalized_note) > 1000
    )
    or p_booking_code is null
    or p_booking_code !~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8,16}$'
    or p_token_key_version is null
    or p_token_key_version <= 0
    or p_receipt_token_hash is null
    or p_receipt_token_hash !~ '^[0-9a-f]{64}$'
    or p_management_token_hash is null
    or p_management_token_hash !~ '^[0-9a-f]{64}$'
    or p_receipt_token_hash = p_management_token_hash
    or p_privacy_notice_version is null
    or char_length(p_privacy_notice_version) not between 1 and 50
    or p_booking_terms_version is null
    or char_length(p_booking_terms_version) not between 1 and 50
    or (
      p_consent_ip_hmac is not null
      and p_consent_ip_hmac !~ '^[0-9a-f]{64}$'
    )
    or p_idempotency_key_hmac is null
    or p_idempotency_key_hmac !~ '^[0-9a-f]{64}$'
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception 'booking_request_invalid'
      using errcode = '22023';
  end if;

  delete from private.idempotency_keys as idempotency
  where idempotency.scope = 'public_booking'
    and idempotency.key_hmac = p_idempotency_key_hmac
    and idempotency.expires_at <= v_now;

  insert into private.idempotency_keys (
    scope,
    key_hmac,
    request_fingerprint,
    expires_at
  )
  values (
    'public_booking',
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
    where idempotency.scope = 'public_booking'
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
      'replayed'::text,
      v_appointment.id,
      v_appointment.booking_code,
      v_appointment.status::text,
      v_appointment.start_at,
      v_appointment.end_at,
      v_appointment.service_name_snapshot,
      v_appointment.quoted_price,
      v_appointment.price_type_snapshot::text,
      v_appointment.currency,
      v_appointment.token_key_version,
      v_appointment.management_token_version,
      v_appointment.duration_minutes_snapshot,
      v_appointment.receipt_token_expires_at,
      v_appointment.management_token_expires_at,
      (
        v_idempotency.result_management_token_version
          = v_appointment.management_token_version
        and v_appointment.management_token_revoked_at is null
        and v_appointment.management_token_expires_at > v_now
      );
    return;
  end if;

  if exists (
    select 1
    from public.appointments as appointment
    where appointment.id = p_appointment_id
  )
  then
    raise exception 'booking_id_unavailable'
      using errcode = '22023';
  end if;

  select provider.id
    into v_provider_id
  from public.providers as provider
  where provider.is_active;

  if not found then
    raise exception 'booking_provider_unavailable'
      using errcode = 'P0001';
  end if;

  perform private.lock_provider_schedule_shared(v_provider_id);

  perform 1
  from public.providers as provider
  where provider.id = v_provider_id
    and provider.is_active
  for share;

  if not found then
    raise exception 'booking_provider_unavailable'
      using errcode = 'P0001';
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

  if v_settings.booking_disabled then
    raise exception 'booking_disabled'
      using errcode = 'P0001';
  end if;

  select service.*
    into v_service
  from public.services as service
  where service.id = p_service_id
    and service.is_active
    and service.is_bookable
  for share;

  if not found then
    raise exception 'service_unavailable'
      using errcode = 'P0001';
  end if;

  v_local_date := (p_start_at at time zone 'Europe/Istanbul')::date;

  if v_local_date < v_today
    or v_local_date > v_today + least(v_settings.maximum_booking_days, 60)
  then
    raise exception 'booking_date_outside_policy'
      using errcode = '22023';
  end if;

  v_end_at := p_start_at
    + v_service.duration_minutes * interval '1 minute';
  v_occupied_start_at := p_start_at
    - v_service.buffer_before_minutes * interval '1 minute';
  v_occupied_end_at := v_end_at
    + v_service.buffer_after_minutes * interval '1 minute';
  v_lock_dates := private.local_dates_for_range(
    v_occupied_start_at,
    v_occupied_end_at
  );

  perform private.lock_provider_dates(v_provider_id, v_lock_dates);

  select policy.id
    into v_privacy_notice_id
  from public.policy_documents as policy
  where policy.policy_type = 'privacy_notice'::public.policy_type
    and policy.version = p_privacy_notice_version
    and policy.is_current
    and policy.published_at is not null
  for share;

  if not found then
    raise exception 'privacy_notice_outdated'
      using errcode = '22023';
  end if;

  select policy.id
    into v_booking_terms_id
  from public.policy_documents as policy
  where policy.policy_type = 'booking_terms'::public.policy_type
    and policy.version = p_booking_terms_version
    and policy.is_current
    and policy.published_at is not null
  for share;

  if not found then
    raise exception 'booking_terms_outdated'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from private.compute_available_slots(
      v_provider_id,
      v_service.id,
      v_local_date,
      v_local_date,
      v_now
    ) as slot
    where slot.start_at = p_start_at
  )
  then
    raise exception 'slot_unavailable'
      using errcode = 'P0001';
  end if;

  insert into public.customers as customer (
    full_name,
    phone_e164,
    email
  )
  values (
    v_normalized_name,
    p_phone_e164,
    v_normalized_email
  )
  on conflict (phone_e164) do update
  set
    full_name = excluded.full_name,
    email = coalesce(excluded.email, customer.email)
  returning id into v_customer_id;

  insert into public.appointments (
    id,
    provider_id,
    customer_id,
    service_id,
    booking_code,
    token_key_version,
    receipt_token_hash,
    receipt_token_expires_at,
    management_token_hash,
    management_token_version,
    management_token_expires_at,
    service_name_snapshot,
    quoted_price,
    price_type_snapshot,
    currency,
    duration_minutes_snapshot,
    buffer_before_minutes_snapshot,
    buffer_after_minutes_snapshot,
    start_at,
    end_at,
    occupied_start_at,
    occupied_end_at,
    status,
    source,
    customer_note,
    privacy_notice_id,
    privacy_notice_version,
    booking_terms_id,
    booking_terms_version,
    consented_at,
    consent_source,
    consent_ip_hmac
  )
  values (
    p_appointment_id,
    v_provider_id,
    v_customer_id,
    v_service.id,
    p_booking_code,
    p_token_key_version,
    p_receipt_token_hash,
    v_now
      + v_settings.receipt_token_lifetime_minutes * interval '1 minute',
    p_management_token_hash,
    1,
    v_now
      + v_settings.management_token_lifetime_minutes * interval '1 minute',
    v_service.name,
    v_service.price,
    v_service.price_type,
    v_service.currency,
    v_service.duration_minutes,
    v_service.buffer_before_minutes,
    v_service.buffer_after_minutes,
    p_start_at,
    v_end_at,
    v_occupied_start_at,
    v_occupied_end_at,
    'confirmed',
    'public_booking',
    v_normalized_note,
    v_privacy_notice_id,
    p_privacy_notice_version,
    v_booking_terms_id,
    p_booking_terms_version,
    v_now,
    'web',
    p_consent_ip_hmac
  )
  returning * into v_appointment;

  insert into private.admin_notifications (
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    'booking_created',
    'appointment',
    v_appointment.id::text,
    'Yeni online randevu',
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
    'public',
    'appointment.created',
    'appointment',
    v_appointment.id::text,
    pg_catalog.jsonb_build_object(
      'source',
      'public_booking',
      'service_id',
      v_service.id,
      'local_date',
      v_local_date
    ),
    p_request_id
  );

  v_result_payload := pg_catalog.jsonb_build_object(
    'appointment_id',
    v_appointment.id,
    'booking_code',
    v_appointment.booking_code,
    'status',
    v_appointment.status::text,
    'start_at',
    v_appointment.start_at,
    'end_at',
    v_appointment.end_at,
    'service_name',
    v_appointment.service_name_snapshot,
    'quoted_price',
    v_appointment.quoted_price,
    'price_type',
    v_appointment.price_type_snapshot::text,
    'currency',
    v_appointment.currency
  );

  update private.idempotency_keys as idempotency
  set
    result_appointment_id = v_appointment.id,
    result_management_token_version = v_appointment.management_token_version,
    result_payload = v_result_payload
  where idempotency.scope = 'public_booking'
    and idempotency.key_hmac = p_idempotency_key_hmac;

  return query
  select
    'created'::text,
    v_appointment.id,
    v_appointment.booking_code,
    v_appointment.status::text,
    v_appointment.start_at,
    v_appointment.end_at,
    v_appointment.service_name_snapshot,
    v_appointment.quoted_price,
    v_appointment.price_type_snapshot::text,
    v_appointment.currency,
    v_appointment.token_key_version,
    v_appointment.management_token_version,
    v_appointment.duration_minutes_snapshot,
    v_appointment.receipt_token_expires_at,
    v_appointment.management_token_expires_at,
    true;
end;
$$;

revoke all on function public.create_public_booking(
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function public.create_public_booking(
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) to service_role;
