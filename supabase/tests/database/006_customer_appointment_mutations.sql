begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(42);

insert into public.providers (id, display_name, is_active)
values (
  '30000000-0000-0000-0000-000000000001',
  'Hazel Mutation Test',
  true
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
  buffer_after_minutes
)
values (
  '30000000-0000-0000-0000-000000000010',
  'Mutation Test Manikür',
  'mutation-test-manikur',
  'Müşteri randevu işlemleri için test hizmeti.',
  'İptal ve tarih değişikliği transaction sınırlarını doğrulayan test hizmetidir.',
  'Manikür',
  850,
  'fixed',
  'TRY',
  60,
  15,
  15
);

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
    '30000000-0000-0000-0000-000000000020',
    'privacy_notice',
    'v1',
    repeat('Gizlilik bildirimi test içeriğidir. ', 3),
    repeat('1', 64),
    statement_timestamp(),
    true
  ),
  (
    '30000000-0000-0000-0000-000000000021',
    'booking_terms',
    'v1',
    repeat('Randevu koşulları test içeriğidir. ', 3),
    repeat('2', 64),
    statement_timestamp(),
    true
  );

insert into public.site_settings (
  singleton,
  business_name,
  phone_e164,
  whatsapp_e164,
  address,
  map_url,
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
  true,
  'Hazel Mutation Test Studio',
  '+905551112233',
  '+905551112233',
  'Buca, İzmir',
  'https://maps.example.test/hazel',
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

insert into public.business_hours (
  provider_id,
  weekday,
  start_time,
  end_time,
  is_open
)
select
  '30000000-0000-0000-0000-000000000001',
  weekday,
  time '09:00',
  time '18:00',
  true
from generate_series(0, 6) as weekdays(weekday);

insert into public.customers (
  id,
  full_name,
  phone_e164,
  email
)
values (
  '30000000-0000-0000-0000-000000000030',
  'Mutation Test Müşteri',
  '+905559998866',
  'mutation@example.com'
);

create temporary table mutation_times as
select
  (
    (statement_timestamp() at time zone 'Europe/Istanbul')::date
      + 7
      + time '10:00'
  ) at time zone 'Europe/Istanbul' as original_start,
  (
    (statement_timestamp() at time zone 'Europe/Istanbul')::date
      + 8
      + time '12:00'
  ) at time zone 'Europe/Istanbul' as rescheduled_start,
  (
    (statement_timestamp() at time zone 'Europe/Istanbul')::date
      + 9
      + time '13:00'
  ) at time zone 'Europe/Istanbul' as later_start;

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
  privacy_notice_id,
  privacy_notice_version,
  booking_terms_id,
  booking_terms_version,
  consented_at,
  consent_source
)
select
  '30000000-0000-0000-0000-000000000040',
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000030',
  '30000000-0000-0000-0000-000000000010',
  'MUTA2345',
  1,
  repeat('a', 64),
  statement_timestamp() + interval '30 days',
  repeat('b', 64),
  1,
  statement_timestamp() + interval '30 days',
  'Mutation Test Manikür',
  850,
  'fixed',
  'TRY',
  60,
  15,
  15,
  original_start,
  original_start + interval '60 minutes',
  original_start - interval '15 minutes',
  original_start + interval '75 minutes',
  'confirmed',
  'public_booking',
  '30000000-0000-0000-0000-000000000020',
  'v1',
  '30000000-0000-0000-0000-000000000021',
  'v1',
  statement_timestamp(),
  'web'
from mutation_times;

insert into private.appointment_access_sessions (
  session_hash,
  appointment_id,
  scope,
  sliding_expires_at,
  absolute_expires_at
)
values
  (
    repeat('c', 64),
    '30000000-0000-0000-0000-000000000040',
    'appointment_manage',
    statement_timestamp() + interval '30 minutes',
    statement_timestamp() + interval '2 hours'
  ),
  (
    repeat('d', 64),
    '30000000-0000-0000-0000-000000000040',
    'receipt_read',
    statement_timestamp() + interval '30 minutes',
    statement_timestamp() + interval '2 hours'
  );

select ok(
  to_regprocedure(
    'private.compute_customer_reschedule_slots(uuid,date,date,timestamptz)'
  ) is not null,
  'the private customer-reschedule slot helper exists'
);
select ok(
  to_regprocedure(
    'public.get_customer_reschedule_availability(text,date,date)'
  ) is not null,
  'the scoped reschedule-availability RPC exists'
);
select ok(
  to_regprocedure(
    'public.reschedule_customer_appointment(text,timestamptz,bigint,text,text,uuid)'
  ) is not null,
  'the customer reschedule RPC exists'
);
select ok(
  to_regprocedure(
    'public.cancel_customer_appointment(text,bigint,text,text,text,uuid)'
  ) is not null,
  'the customer cancellation RPC exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_customer_reschedule_availability(text,date,date)',
    'EXECUTE'
  ),
  'anonymous callers cannot query management-session availability'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_customer_reschedule_availability(text,date,date)',
    'EXECUTE'
  ),
  'authenticated callers cannot query management-session availability directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_customer_reschedule_availability(text,date,date)',
    'EXECUTE'
  ),
  'service role may execute the reviewed reschedule-availability entry point'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reschedule_customer_appointment(text,timestamptz,bigint,text,text,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot reschedule appointments directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.reschedule_customer_appointment(text,timestamptz,bigint,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated callers cannot reschedule appointments directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reschedule_customer_appointment(text,timestamptz,bigint,text,text,uuid)',
    'EXECUTE'
  ),
  'service role may execute the reviewed customer-reschedule entry point'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.cancel_customer_appointment(text,bigint,text,text,text,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot cancel appointments directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.cancel_customer_appointment(text,bigint,text,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated callers cannot cancel appointments directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.cancel_customer_appointment(text,bigint,text,text,text,uuid)',
    'EXECUTE'
  ),
  'service role may execute the reviewed customer-cancellation entry point'
);

select is(
  (
    select service_id
    from public.get_appointment_access_session(
      repeat('c', 64),
      'appointment_manage'
    )
  ),
  '30000000-0000-0000-0000-000000000010'::uuid,
  'management-session views expose the public service identifier'
);
select is(
  (
    select maximum_booking_days
    from public.get_appointment_access_session(
      repeat('c', 64),
      'appointment_manage'
    )
  ),
  60,
  'management-session views expose the bounded booking horizon'
);

select throws_ok(
  $$
    select *
    from public.get_customer_reschedule_availability(
      repeat('d', 64),
      (statement_timestamp() at time zone 'Europe/Istanbul')::date,
      (statement_timestamp() at time zone 'Europe/Istanbul')::date + 14
    )
  $$,
  'P0001',
  'appointment_session_invalid',
  'a receipt session cannot query private reschedule availability'
);

select ok(
  (
    select count(*) > 0
    from public.get_customer_reschedule_availability(
      repeat('c', 64),
      (statement_timestamp() at time zone 'Europe/Istanbul')::date + 8,
      (statement_timestamp() at time zone 'Europe/Istanbul')::date + 8
    ) as slot
    cross join mutation_times as test_time
    where slot.start_at = test_time.rescheduled_start
  ),
  'a management session receives a valid alternative slot'
);

select throws_ok(
  $$
    select *
    from public.reschedule_customer_appointment(
      repeat('c', 64),
      (select rescheduled_start from mutation_times),
      99,
      repeat('e', 64),
      repeat('f', 64),
      '30000000-0000-0000-0000-000000000050'
    )
  $$,
  '40001',
  'stale_appointment',
  'rescheduling rejects a stale appointment row version'
);

create temporary table reschedule_result as
select *
from public.reschedule_customer_appointment(
  repeat('c', 64),
  (select rescheduled_start from mutation_times),
  0,
  repeat('1', 64),
  repeat('2', 64),
  '30000000-0000-0000-0000-000000000051'
);

select is(
  (select appointment_start_at from reschedule_result),
  (select rescheduled_start from mutation_times),
  'rescheduling stores the selected start time'
);
select is(
  (select result_row_version from reschedule_result),
  1::bigint,
  'rescheduling increments the appointment row version once'
);
select is(
  (
    select management_token_hash
    from public.appointments
    where id = '30000000-0000-0000-0000-000000000040'
  ),
  repeat('b', 64),
  'normal rescheduling preserves the management-token hash'
);
select is(
  (
    select management_token_version
    from public.appointments
    where id = '30000000-0000-0000-0000-000000000040'
  ),
  1,
  'normal rescheduling preserves the management-token version'
);
select is(
  (
    select revoked_at
    from private.appointment_access_sessions
    where session_hash = repeat('c', 64)
  ),
  null::timestamptz,
  'normal rescheduling preserves the active management session'
);
select ok(
  exists (
    select 1
    from private.audit_logs
    where request_id = '30000000-0000-0000-0000-000000000051'
      and action = 'appointment.rescheduled'
  ),
  'rescheduling writes an audit record'
);
select ok(
  exists (
    select 1
    from private.admin_notifications
    where entity_id = '30000000-0000-0000-0000-000000000040'
      and notification_type = 'booking_rescheduled'
  ),
  'rescheduling creates an admin notification'
);
select ok(
  (
    select not private.jsonb_contains_sensitive_key(result_payload)
    from private.idempotency_keys
    where scope = 'customer_reschedule'
      and key_hmac = repeat('1', 64)
  ),
  'reschedule idempotency stores no private credential keys'
);
select is(
  (
    select appointment_start_at
    from public.reschedule_customer_appointment(
      repeat('c', 64),
      (select rescheduled_start from mutation_times),
      0,
      repeat('1', 64),
      repeat('2', 64),
      '30000000-0000-0000-0000-000000000052'
    )
  ),
  (select rescheduled_start from mutation_times),
  'an identical reschedule retry returns the committed result'
);
select throws_ok(
  $$
    select *
    from public.reschedule_customer_appointment(
      repeat('c', 64),
      (select rescheduled_start from mutation_times),
      0,
      repeat('1', 64),
      repeat('3', 64),
      '30000000-0000-0000-0000-000000000053'
    )
  $$,
  '22023',
  'idempotency_key_reuse',
  'a reschedule key cannot be reused with a different fingerprint'
);

update public.site_settings
set reschedule_deadline_minutes = 43200
where singleton;

select throws_ok(
  $$
    select *
    from public.reschedule_customer_appointment(
      repeat('c', 64),
      (select later_start from mutation_times),
      1,
      repeat('4', 64),
      repeat('5', 64),
      '30000000-0000-0000-0000-000000000054'
    )
  $$,
  'P0001',
  'reschedule_deadline_passed',
  'rescheduling enforces the current deadline'
);

update public.site_settings
set reschedule_deadline_minutes = 1440
where singleton;

select throws_ok(
  $$
    select *
    from public.cancel_customer_appointment(
      repeat('c', 64),
      99,
      '',
      repeat('6', 64),
      repeat('7', 64),
      '30000000-0000-0000-0000-000000000055'
    )
  $$,
  '40001',
  'stale_appointment',
  'cancellation rejects a stale appointment row version'
);

create temporary table cancellation_result as
select *
from public.cancel_customer_appointment(
  repeat('c', 64),
  1,
  'Programım değişti',
  repeat('8', 64),
  repeat('9', 64),
  '30000000-0000-0000-0000-000000000056'
);

select is(
  (select appointment_status from cancellation_result),
  'cancelled',
  'cancellation returns the terminal appointment status'
);
select is(
  (select result_row_version from cancellation_result),
  2::bigint,
  'cancellation increments the appointment row version once'
);
select ok(
  (
    select management_token_revoked_at is not null
    from public.appointments
    where id = '30000000-0000-0000-0000-000000000040'
  ),
  'cancellation revokes the management token'
);
select ok(
  (
    select bool_and(revoked_at is not null)
    from private.appointment_access_sessions
    where appointment_id = '30000000-0000-0000-0000-000000000040'
      and scope = 'appointment_manage'
  ),
  'cancellation revokes every active management session'
);
select is(
  (
    select receipt_token_revoked_at
    from public.appointments
    where id = '30000000-0000-0000-0000-000000000040'
  ),
  null::timestamptz,
  'cancellation preserves the read-only receipt token'
);
select ok(
  exists (
    select 1
    from private.audit_logs
    where request_id = '30000000-0000-0000-0000-000000000056'
      and action = 'appointment.cancelled'
  ),
  'cancellation writes an audit record'
);
select ok(
  exists (
    select 1
    from private.admin_notifications
    where entity_id = '30000000-0000-0000-0000-000000000040'
      and notification_type = 'booking_cancelled'
  ),
  'cancellation creates an admin notification'
);
select ok(
  (
    select not private.jsonb_contains_sensitive_key(result_payload)
    from private.idempotency_keys
    where scope = 'customer_cancellation'
      and key_hmac = repeat('8', 64)
  ),
  'cancellation idempotency stores no private credential keys'
);
select is(
  (
    select appointment_status
    from public.cancel_customer_appointment(
      repeat('c', 64),
      1,
      'Programım değişti',
      repeat('8', 64),
      repeat('9', 64),
      '30000000-0000-0000-0000-000000000057'
    )
  ),
  'cancelled',
  'an identical cancellation retry succeeds after session revocation'
);
select throws_ok(
  $$
    select *
    from public.cancel_customer_appointment(
      repeat('c', 64),
      1,
      'Programım değişti',
      repeat('8', 64),
      repeat('0', 64),
      '30000000-0000-0000-0000-000000000058'
    )
  $$,
  '22023',
  'idempotency_key_reuse',
  'a cancellation key cannot be reused with a different fingerprint'
);
select throws_ok(
  $$
    select *
    from public.get_appointment_access_session(
      repeat('c', 64),
      'appointment_manage'
    )
  $$,
  'P0001',
  'appointment_session_invalid',
  'a cancelled appointment cannot reuse its management session'
);
select is(
  (
    select appointment_status
    from public.get_appointment_access_session(
      repeat('d', 64),
      'receipt_read'
    )
  ),
  'cancelled',
  'the read-only receipt session can show the cancelled state'
);

select * from finish();
rollback;
