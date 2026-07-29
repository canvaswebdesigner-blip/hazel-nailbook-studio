begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(45);

create temporary table booking_test_context (
  local_date date not null
) on commit drop;

insert into booking_test_context (local_date)
values (
  (statement_timestamp() at time zone 'Europe/Istanbul')::date + 7
);

insert into public.providers (
  id,
  display_name,
  is_active
)
values (
  '10000000-0000-0000-0000-000000000001',
  'Hazel Test',
  true
);

insert into public.site_settings (
  business_name,
  timezone,
  currency,
  minimum_notice_minutes,
  maximum_booking_days,
  cancellation_deadline_minutes,
  reschedule_deadline_minutes,
  slot_granularity_minutes,
  receipt_token_lifetime_minutes,
  management_token_lifetime_minutes,
  booking_disabled
)
values (
  'Hazel Test Studio',
  'Europe/Istanbul',
  'TRY',
  0,
  60,
  1440,
  1440,
  15,
  43200,
  43200,
  false
);

insert into public.services (
  id,
  name,
  slug,
  short_description,
  description,
  category,
  price,
  price_type,
  currency,
  duration_minutes,
  buffer_before_minutes,
  buffer_after_minutes,
  is_active,
  is_bookable
)
values (
  '10000000-0000-0000-0000-000000000010',
  'Kalici Oje',
  'kalici-oje-test',
  'Test icin yeterince uzun kisa aciklama.',
  'Test icin kullanilan ve yeterince uzun olan hizmet aciklamasi.',
  'Bakim',
  1000,
  'fixed',
  'TRY',
  60,
  15,
  15,
  true,
  true
);

insert into public.business_hours (
  provider_id,
  weekday,
  start_time,
  end_time,
  is_open
)
select
  '10000000-0000-0000-0000-000000000001',
  weekday,
  time '09:00',
  time '18:00',
  true
from generate_series(0, 6) as weekdays(weekday);

insert into public.policy_documents (
  id,
  policy_type,
  version,
  content,
  content_sha256,
  published_at,
  is_current
)
values
  (
    '10000000-0000-0000-0000-000000000020',
    'privacy_notice',
    'v1',
    repeat('Privacy notice test content. ', 3),
    repeat('a', 64),
    statement_timestamp(),
    true
  ),
  (
    '10000000-0000-0000-0000-000000000021',
    'booking_terms',
    'v1',
    repeat('Booking terms test content. ', 3),
    repeat('b', 64),
    statement_timestamp(),
    true
  ),
  (
    '10000000-0000-0000-0000-000000000022',
    'privacy_notice',
    'old',
    repeat('Old privacy notice test content. ', 3),
    repeat('c', 64),
    statement_timestamp() - interval '1 day',
    false
  );

select ok(
  to_regprocedure(
    'public.get_public_availability(uuid,date,date)'
  ) is not null,
  'public availability function exists'
);
select ok(
  to_regprocedure(
    'public.create_public_booking(uuid,uuid,timestamp with time zone,text,text,text,text,text,integer,text,text,text,text,text,text,text,uuid)'
  ) is not null,
  'public booking function exists'
);
select ok(
  to_regprocedure(
    'public.consume_public_rate_limit(text,text,integer,integer)'
  ) is not null,
  'atomic public rate-limit entry point exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_public_availability(uuid,date,date)',
    'EXECUTE'
  ),
  'anonymous users cannot bypass the server availability rate-limit boundary'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_public_availability(uuid,date,date)',
    'EXECUTE'
  ),
  'service role may execute bounded public availability'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.consume_public_rate_limit(text,text,integer,integer)',
    'EXECUTE'
  ),
  'service role may atomically consume a public rate limit'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.consume_public_rate_limit(text,text,integer,integer)',
    'EXECUTE'
  ),
  'anonymous users cannot update private rate-limit counters'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_public_booking(uuid,uuid,timestamp with time zone,text,text,text,text,text,integer,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'service role may execute the reviewed booking entry point'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_public_booking(uuid,uuid,timestamp with time zone,text,text,text,text,text,integer,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot execute booking writes directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_public_booking(uuid,uuid,timestamp with time zone,text,text,text,text,text,integer,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot execute booking writes directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.compute_available_slots(uuid,uuid,date,date,timestamp with time zone)',
    'EXECUTE'
  ),
  'anonymous users cannot invoke the private availability helper'
);

create temporary table booking_rate_results (
  attempt integer primary key,
  allowed boolean not null,
  remaining integer not null,
  retry_after_seconds integer not null
) on commit drop;

do $$
begin
  insert into booking_rate_results
  select
    1,
    rate_result.allowed,
    rate_result.remaining,
    rate_result.retry_after_seconds
  from public.consume_public_rate_limit(
    'availability',
    repeat('f', 64),
    3600,
    1
  ) as rate_result;

  insert into booking_rate_results
  select
    2,
    rate_result.allowed,
    rate_result.remaining,
    rate_result.retry_after_seconds
  from public.consume_public_rate_limit(
    'availability',
    repeat('f', 64),
    3600,
    1
  ) as rate_result;
end;
$$;

select is(
  (
    select
      rate_result.allowed::text
      || ':'
      || rate_result.remaining::text
      || ':'
      || rate_result.retry_after_seconds::text
    from booking_rate_results as rate_result
    where rate_result.attempt = 1
  ),
  'true:0:0',
  'the first request in a fixed window is allowed atomically'
);
select ok(
  (
    select
      not rate_result.allowed
      and rate_result.remaining = 0
      and rate_result.retry_after_seconds > 0
    from booking_rate_results as rate_result
    where rate_result.attempt = 2
  ),
  'a request over the fixed-window limit returns a retry duration'
);
select is(
  (
    select count(*)::integer
    from private.rate_limit_counters
    where scope = 'availability'
      and bucket_hmac = repeat('f', 64)
      and request_count = 2
  ),
  1,
  'concurrent-safe rate limiting uses one atomic counter row per window'
);
select throws_ok(
  $$
    select *
    from public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      (statement_timestamp() at time zone 'Europe/Istanbul')::date,
      (statement_timestamp() at time zone 'Europe/Istanbul')::date + 60
    )
  $$,
  '22023',
  'availability_range_invalid',
  'one availability request cannot span more than 60 calendar days'
);
select throws_ok(
  $$
    select *
    from public.get_public_availability(
      '10000000-0000-0000-0000-000000000099',
      (statement_timestamp() at time zone 'Europe/Istanbul')::date,
      (statement_timestamp() at time zone 'Europe/Istanbul')::date
    )
  $$,
  'P0001',
  'service_unavailable',
  'an unavailable service is not misrepresented as an empty calendar'
);

update public.providers
set is_active = false
where id = '10000000-0000-0000-0000-000000000001';

select throws_ok(
  $$
    select *
    from public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      (statement_timestamp() at time zone 'Europe/Istanbul')::date,
      (statement_timestamp() at time zone 'Europe/Istanbul')::date
    )
  $$,
  'P0001',
  'booking_provider_unavailable',
  'an inactive provider is reported as unavailable instead of an empty calendar'
);

update public.providers
set is_active = true
where id = '10000000-0000-0000-0000-000000000001';

update public.site_settings
set maximum_booking_days = 5
where singleton;

select throws_ok(
  $$
    select *
    from booking_test_context as context
    cross join lateral public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      context.local_date,
      context.local_date
    )
  $$,
  '22023',
  'availability_range_outside_policy',
  'availability cannot be queried beyond the configured booking window'
);

update public.site_settings
set
  maximum_booking_days = 60,
  minimum_notice_minutes = 10080
where singleton;

select is(
  (
    select count(*)::integer
    from public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      (statement_timestamp() at time zone 'Europe/Istanbul')::date,
      (statement_timestamp() at time zone 'Europe/Istanbul')::date
    )
  ),
  0,
  'minimum notice removes slots that are too close to the request time'
);

update public.site_settings
set minimum_notice_minutes = 0
where singleton;

select is(
  (
    select min((availability.start_at at time zone 'Europe/Istanbul')::time)
    from booking_test_context as context
    cross join lateral public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      context.local_date,
      context.local_date
    ) as availability
  ),
  time '09:15',
  'the first slot keeps the before-buffer inside business hours'
);

insert into public.availability_blocks (
  id,
  provider_id,
  start_at,
  end_at,
  block_type,
  reason
)
select
  '10000000-0000-0000-0000-000000000030',
  '10000000-0000-0000-0000-000000000001',
  (context.local_date + time '10:00') at time zone 'Europe/Istanbul',
  (context.local_date + time '11:00') at time zone 'Europe/Istanbul',
  'break',
  'Test break'
from booking_test_context as context;

select is(
  (
    select count(*)::integer
    from booking_test_context as context
    cross join lateral public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      context.local_date,
      context.local_date
    ) as availability
    where (availability.start_at at time zone 'Europe/Istanbul')::time
      = time '10:15'
  ),
  0,
  'a slot whose occupied range overlaps a break is removed'
);
select is(
  (
    select count(*)::integer
    from booking_test_context as context
    cross join lateral public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      context.local_date,
      context.local_date
    ) as availability
    where (availability.start_at at time zone 'Europe/Istanbul')::time
      = time '11:15'
  ),
  1,
  'a half-open slot beginning after the break remains available'
);

insert into public.schedule_exceptions (
  provider_id,
  local_date,
  exception_type,
  reason
)
select
  '10000000-0000-0000-0000-000000000001',
  context.local_date + 1,
  'closed',
  'Test closure'
from booking_test_context as context;

select is(
  (
    select count(*)::integer
    from booking_test_context as context
    cross join lateral public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      context.local_date + 1,
      context.local_date + 1
    )
  ),
  0,
  'a closed schedule exception removes the full day'
);

delete from public.availability_blocks
where id = '10000000-0000-0000-0000-000000000030';

select is(
  (
    select result.result_kind
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000040',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '13:00') at time zone 'Europe/Istanbul',
      'Test Customer',
      '+905551112233',
      'TEST@EXAMPLE.COM',
      'Customer note',
      'ABCD2345',
      1,
      repeat('1', 64),
      repeat('2', 64),
      'v1',
      'v1',
      repeat('3', 64),
      repeat('4', 64),
      repeat('5', 64),
      '10000000-0000-0000-0000-000000000050'
    ) as result
  ),
  'created',
  'a valid public booking returns a structured created result'
);
select ok(
  (
    select
      result.token_key_version = 1
      and result.management_token_version = 1
      and result.duration_minutes = 60
      and result.receipt_expires_at > statement_timestamp()
      and result.management_expires_at > statement_timestamp()
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000040',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '13:00') at time zone 'Europe/Istanbul',
      'Test Customer',
      '+905551112233',
      'TEST@EXAMPLE.COM',
      'Customer note',
      'ABCD2345',
      1,
      repeat('1', 64),
      repeat('2', 64),
      'v1',
      'v1',
      repeat('3', 64),
      repeat('4', 64),
      repeat('5', 64),
      '10000000-0000-0000-0000-000000000050'
    ) as result
  ),
  'booking results expose only the safe versions and expiry metadata needed for token reconstruction'
);
select is(
  (
    select count(*)::integer
    from public.appointments
    where id = '10000000-0000-0000-0000-000000000040'
  ),
  1,
  'a valid booking creates exactly one confirmed appointment'
);
select is(
  (
    select
      service_name_snapshot
      || ':'
      || duration_minutes_snapshot::text
      || ':'
      || buffer_before_minutes_snapshot::text
      || ':'
      || buffer_after_minutes_snapshot::text
    from public.appointments
    where id = '10000000-0000-0000-0000-000000000040'
  ),
  'Kalici Oje:60:15:15',
  'booking stores immutable service duration and buffer snapshots'
);
select is(
  (
    select
      privacy_notice_id::text
      || ':'
      || privacy_notice_version
      || ':'
      || booking_terms_id::text
      || ':'
      || booking_terms_version
      || ':'
      || consent_source
    from public.appointments
    where id = '10000000-0000-0000-0000-000000000040'
  ),
  '10000000-0000-0000-0000-000000000020:v1:10000000-0000-0000-0000-000000000021:v1:web',
  'booking resolves and stores the current policy identities and consent evidence'
);
select is(
  (
    select count(*)::integer
    from private.admin_notifications
    where entity_id = '10000000-0000-0000-0000-000000000040'
      and notification_type = 'booking_created'
  ),
  1,
  'booking creates one admin notification'
);
select is(
  (
    select count(*)::integer
    from private.audit_logs
    where entity_id = '10000000-0000-0000-0000-000000000040'
      and action = 'appointment.created'
  ),
  1,
  'booking creates one safe audit record'
);
select ok(
  not private.jsonb_contains_sensitive_key(
    (
      select result_payload
      from private.idempotency_keys
      where scope = 'public_booking'
        and key_hmac = repeat('4', 64)
    )
  ),
  'the stored idempotent result contains no private credential key'
);
select is(
  (
    select result.result_kind
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000040',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '13:00') at time zone 'Europe/Istanbul',
      'Test Customer',
      '+905551112233',
      'TEST@EXAMPLE.COM',
      'Customer note',
      'ABCD2345',
      1,
      repeat('1', 64),
      repeat('2', 64),
      'v1',
      'v1',
      repeat('3', 64),
      repeat('4', 64),
      repeat('5', 64),
      '10000000-0000-0000-0000-000000000050'
    ) as result
  ),
  'replayed',
  'an identical idempotent retry returns the committed result'
);
select is(
  (
    select count(*)::integer
    from public.appointments
    where id = '10000000-0000-0000-0000-000000000040'
  ),
  1,
  'an idempotent retry does not create another appointment'
);
select throws_ok(
  $$
    select *
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000040',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '16:30') at time zone 'Europe/Istanbul',
      'Duplicate Identifier',
      '+905551112266',
      null,
      null,
      'ABCD2352',
      1,
      repeat('a', 64),
      repeat('b', 64),
      'v1',
      'v1',
      null,
      repeat('c', 64),
      repeat('d', 64),
      '10000000-0000-0000-0000-000000000055'
    )
  $$,
  '22023',
  'booking_id_unavailable',
  'a fresh idempotency key cannot reuse an existing appointment identifier'
);
select throws_ok(
  $$
    select *
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000040',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '13:00') at time zone 'Europe/Istanbul',
      'Test Customer',
      '+905551112233',
      'test@example.com',
      'Changed note',
      'ABCD2345',
      1,
      repeat('1', 64),
      repeat('2', 64),
      'v1',
      'v1',
      repeat('3', 64),
      repeat('4', 64),
      repeat('6', 64),
      '10000000-0000-0000-0000-000000000050'
    )
  $$,
  '22023',
  'idempotency_key_reuse',
  'an idempotency key cannot be reused for a different request'
);
select throws_ok(
  $$
    select *
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000041',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '13:30') at time zone 'Europe/Istanbul',
      'Other Customer',
      '+905551112244',
      null,
      null,
      'ABCD2346',
      1,
      repeat('7', 64),
      repeat('8', 64),
      'v1',
      'v1',
      null,
      repeat('9', 64),
      repeat('a', 64),
      '10000000-0000-0000-0000-000000000051'
    )
  $$,
  'P0001',
  'slot_unavailable',
  'fresh availability rejects an occupied slot before insertion'
);

update public.site_settings
set booking_disabled = true
where singleton;

select throws_ok(
  $$
    select *
    from booking_test_context as context
    cross join lateral public.get_public_availability(
      '10000000-0000-0000-0000-000000000010',
      context.local_date,
      context.local_date
    )
  $$,
  'P0001',
  'booking_disabled',
  'public availability reports an explicit disabled-booking state'
);
select throws_ok(
  $$
    select *
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000042',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '15:00') at time zone 'Europe/Istanbul',
      'Other Customer',
      '+905551112244',
      null,
      null,
      'ABCD2347',
      1,
      repeat('b', 64),
      repeat('c', 64),
      'v1',
      'v1',
      null,
      repeat('d', 64),
      repeat('e', 64),
      '10000000-0000-0000-0000-000000000052'
    )
  $$,
  'P0001',
  'booking_disabled',
  'new bookings fail closed while booking is disabled'
);
select is(
  (
    select result.result_kind
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000040',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '13:00') at time zone 'Europe/Istanbul',
      'Test Customer',
      '+905551112233',
      'TEST@EXAMPLE.COM',
      'Customer note',
      'ABCD2345',
      1,
      repeat('1', 64),
      repeat('2', 64),
      'v1',
      'v1',
      repeat('3', 64),
      repeat('4', 64),
      repeat('5', 64),
      '10000000-0000-0000-0000-000000000050'
    ) as result
  ),
  'replayed',
  'a committed idempotent result remains replayable after booking is disabled'
);

update public.site_settings
set booking_disabled = false
where singleton;

update public.customers
set private_notes = 'Hazel private note'
where phone_e164 = '+905551112233';

select is(
  (
    select result.result_kind
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000043',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '15:00') at time zone 'Europe/Istanbul',
      'Updated Customer',
      '+905551112233',
      null,
      null,
      'ABCD2348',
      1,
      repeat('d', 64),
      repeat('e', 64),
      'v1',
      'v1',
      null,
      repeat('f', 64),
      repeat('0', 64),
      '10000000-0000-0000-0000-000000000053'
    ) as result
  ),
  'created',
  'the same normalized phone safely reuses the existing customer'
);
select is(
  (
    select private_notes
    from public.customers
    where phone_e164 = '+905551112233'
  ),
  'Hazel private note',
  'public customer upsert never overwrites private notes'
);
select is(
  (
    select count(*)::integer
    from public.customers
    where phone_e164 = '+905551112233'
  ),
  1,
  'customer phone identity remains unique'
);
select is(
  (
    select count(*)::integer
    from public.appointments
    where customer_id = (
      select id
      from public.customers
      where phone_e164 = '+905551112233'
    )
  ),
  2,
  'repeat customers may own multiple non-overlapping appointments'
);
select throws_ok(
  $$
    select *
    from booking_test_context as context
    cross join lateral public.create_public_booking(
      '10000000-0000-0000-0000-000000000044',
      '10000000-0000-0000-0000-000000000010',
      (context.local_date + time '16:30') at time zone 'Europe/Istanbul',
      'Policy Customer',
      '+905551112255',
      null,
      null,
      'ABCD2349',
      1,
      repeat('6', 64),
      repeat('7', 64),
      'old',
      'v1',
      null,
      repeat('8', 64),
      repeat('9', 64),
      '10000000-0000-0000-0000-000000000054'
    )
  $$,
  '22023',
  'privacy_notice_outdated',
  'booking rejects consent to a non-current privacy notice'
);
select is(
  (
    select email
    from public.customers
    where phone_e164 = '+905551112233'
  ),
  'test@example.com',
  'customer email is normalized and preserved when a later booking omits it'
);

select * from finish();
rollback;
