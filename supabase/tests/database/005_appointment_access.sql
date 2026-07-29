begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(30);

insert into public.providers (id, display_name, is_active)
values (
  '20000000-0000-0000-0000-000000000001',
  'Hazel Test',
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
  '20000000-0000-0000-0000-000000000010',
  'Test Manikür',
  'test-manikur',
  'Randevu erişim testi için hizmet.',
  'Randevu erişim oturumlarını doğrulamak için kullanılan test hizmetidir.',
  'Manikür',
  750,
  'fixed',
  'TRY',
  60,
  0,
  0
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
    '20000000-0000-0000-0000-000000000020',
    'privacy_notice',
    'v1',
    repeat('Gizlilik bildirimi test içeriğidir. ', 3),
    repeat('1', 64),
    statement_timestamp(),
    true
  ),
  (
    '20000000-0000-0000-0000-000000000021',
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
  'Hazel Test Studio',
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
  10080,
  10080,
  false
);

insert into public.customers (
  id,
  full_name,
  phone_e164,
  email
)
values (
  '20000000-0000-0000-0000-000000000030',
  'Test Müşteri',
  '+905559998877',
  'test@example.com'
);

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
  '20000000-0000-0000-0000-000000000040',
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000030',
  '20000000-0000-0000-0000-000000000010',
  'ABCD2345',
  1,
  repeat('a', 64),
  statement_timestamp() + interval '1 day',
  repeat('b', 64),
  1,
  statement_timestamp() + interval '1 day',
  'Test Manikür',
  750,
  'fixed',
  'TRY',
  60,
  0,
  0,
  (
    (statement_timestamp() at time zone 'Europe/Istanbul')::date
      + 7
      + time '10:00'
  ) at time zone 'Europe/Istanbul',
  (
    (statement_timestamp() at time zone 'Europe/Istanbul')::date
      + 7
      + time '11:00'
  ) at time zone 'Europe/Istanbul',
  (
    (statement_timestamp() at time zone 'Europe/Istanbul')::date
      + 7
      + time '10:00'
  ) at time zone 'Europe/Istanbul',
  (
    (statement_timestamp() at time zone 'Europe/Istanbul')::date
      + 7
      + time '11:00'
  ) at time zone 'Europe/Istanbul',
  'confirmed',
  'web',
  '20000000-0000-0000-0000-000000000020',
  'v1',
  '20000000-0000-0000-0000-000000000021',
  'v1',
  statement_timestamp(),
  'web';

select ok(
  to_regprocedure(
    'public.exchange_appointment_access_token(text,text,text,uuid)'
  ) is not null,
  'token exchange function exists'
);
select ok(
  to_regprocedure(
    'public.get_appointment_access_session(text,text)'
  ) is not null,
  'appointment session reader exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.exchange_appointment_access_token(text,text,text,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot exchange appointment tokens directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.exchange_appointment_access_token(text,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot exchange appointment tokens directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.exchange_appointment_access_token(text,text,text,uuid)',
    'EXECUTE'
  ),
  'service role may execute the reviewed token exchange entry point'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.get_appointment_access_session(text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot read private appointment sessions directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_appointment_access_session(text,text)',
    'EXECUTE'
  ),
  'authenticated users cannot read private appointment sessions directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_appointment_access_session(text,text)',
    'EXECUTE'
  ),
  'service role may read a validated appointment session'
);
select throws_ok(
  $$
    select *
    from public.exchange_appointment_access_token(
      'not-a-hash',
      'receipt_read',
      repeat('c', 64),
      '20000000-0000-0000-0000-000000000050'
    )
  $$,
  '22023',
  'appointment_access_request_invalid',
  'malformed token hashes are rejected before lookup'
);
select throws_ok(
  $$
    select *
    from public.exchange_appointment_access_token(
      repeat('a', 64),
      'unsupported_scope',
      repeat('c', 64),
      '20000000-0000-0000-0000-000000000051'
    )
  $$,
  '22023',
  'appointment_access_request_invalid',
  'unsupported appointment access scopes are rejected'
);
select throws_ok(
  $$
    select *
    from public.exchange_appointment_access_token(
      repeat('9', 64),
      'receipt_read',
      repeat('c', 64),
      '20000000-0000-0000-0000-000000000052'
    )
  $$,
  'P0001',
  'appointment_link_invalid',
  'unknown appointment links return a generic failure'
);

create temporary table receipt_exchange as
select *
from public.exchange_appointment_access_token(
  repeat('a', 64),
  'receipt_read',
  repeat('c', 64),
  '20000000-0000-0000-0000-000000000053'
);

select is(
  (select appointment_id from receipt_exchange),
  '20000000-0000-0000-0000-000000000040'::uuid,
  'receipt exchange resolves the intended appointment'
);
select is(
  (select access_scope from receipt_exchange),
  'receipt_read',
  'receipt exchange creates a read-only scope'
);
select is(
  (
    select count(*)::integer
    from private.appointment_access_sessions
    where session_hash = repeat('c', 64)
      and scope = 'receipt_read'
  ),
  1,
  'receipt exchange stores only the supplied session hash'
);
select ok(
  (
    select
      action = 'appointment.access_link_exchanged'
      and not private.jsonb_contains_sensitive_key(metadata)
    from private.audit_logs
    where request_id = '20000000-0000-0000-0000-000000000053'
  ),
  'receipt exchange audit metadata contains no private credential keys'
);
select is(
  (
    select booking_code || ':' || appointment_status
    from public.get_appointment_access_session(
      repeat('c', 64),
      'receipt_read'
    )
  ),
  'ABCD2345:confirmed',
  'receipt sessions return only the matching appointment view'
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
  'a receipt session cannot be upgraded to management scope'
);
select is(
  (
    select can_cancel
    from public.get_appointment_access_session(
      repeat('c', 64),
      'receipt_read'
    )
  ),
  false,
  'receipt sessions cannot cancel appointments'
);
select is(
  (
    select can_reschedule
    from public.get_appointment_access_session(
      repeat('c', 64),
      'receipt_read'
    )
  ),
  false,
  'receipt sessions cannot reschedule appointments'
);
select ok(
  (
    select absolute_expires_at <= created_at + interval '2 hours'
    from private.appointment_access_sessions
    where session_hash = repeat('c', 64)
  ),
  'receipt access sessions have a hard two-hour maximum lifetime'
);

create temporary table manage_exchange as
select *
from public.exchange_appointment_access_token(
  repeat('b', 64),
  'appointment_manage',
  repeat('d', 64),
  '20000000-0000-0000-0000-000000000054'
);

select is(
  (select appointment_id from manage_exchange),
  '20000000-0000-0000-0000-000000000040'::uuid,
  'management exchange resolves the intended appointment'
);
select is(
  (select access_scope from manage_exchange),
  'appointment_manage',
  'management exchange creates management scope'
);
select is(
  (
    select count(*)::integer
    from private.appointment_access_sessions
    where session_hash = repeat('d', 64)
      and scope = 'appointment_manage'
  ),
  1,
  'management exchange stores a scoped private session'
);
select ok(
  (
    select can_cancel and can_reschedule
    from public.get_appointment_access_session(
      repeat('d', 64),
      'appointment_manage'
    )
  ),
  'a future confirmed appointment is manageable before both deadlines'
);
select is(
  (
    select row_version
    from public.get_appointment_access_session(
      repeat('d', 64),
      'appointment_manage'
    )
  ),
  0::bigint,
  'management reads expose the row version required for safe mutations'
);

update private.appointment_access_sessions
set
  created_at = statement_timestamp() - interval '10 minutes',
  last_seen_at = statement_timestamp() - interval '9 minutes',
  sliding_expires_at = statement_timestamp() + interval '5 minutes',
  absolute_expires_at = statement_timestamp() + interval '110 minutes'
where session_hash = repeat('c', 64);

do $$
begin
  perform *
  from public.get_appointment_access_session(
    repeat('c', 64),
    'receipt_read'
  );
end;
$$;

select ok(
  (
    select last_seen_at > statement_timestamp() - interval '1 minute'
    from private.appointment_access_sessions
    where session_hash = repeat('c', 64)
  ),
  'a valid session read refreshes its last-seen time'
);

update private.appointment_access_sessions
set
  created_at = statement_timestamp() - interval '2 hours',
  last_seen_at = statement_timestamp() - interval '30 minutes',
  sliding_expires_at = statement_timestamp() - interval '2 minutes',
  absolute_expires_at = statement_timestamp() - interval '1 minute'
where session_hash = repeat('c', 64);

select throws_ok(
  $$
    select *
    from public.get_appointment_access_session(
      repeat('c', 64),
      'receipt_read'
    )
  $$,
  'P0001',
  'appointment_session_invalid',
  'expired access sessions are rejected'
);

update private.appointment_access_sessions
set revoked_at = statement_timestamp()
where session_hash = repeat('d', 64);

select throws_ok(
  $$
    select *
    from public.get_appointment_access_session(
      repeat('d', 64),
      'appointment_manage'
    )
  $$,
  'P0001',
  'appointment_session_invalid',
  'revoked management sessions are rejected'
);

update public.appointments
set management_token_revoked_at = statement_timestamp()
where id = '20000000-0000-0000-0000-000000000040';

select throws_ok(
  $$
    select *
    from public.exchange_appointment_access_token(
      repeat('b', 64),
      'appointment_manage',
      repeat('e', 64),
      '20000000-0000-0000-0000-000000000055'
    )
  $$,
  'P0001',
  'appointment_link_invalid',
  'a revoked management token cannot create a new session'
);

update public.appointments
set receipt_token_revoked_at = statement_timestamp()
where id = '20000000-0000-0000-0000-000000000040';

select throws_ok(
  $$
    select *
    from public.exchange_appointment_access_token(
      repeat('a', 64),
      'receipt_read',
      repeat('f', 64),
      '20000000-0000-0000-0000-000000000056'
    )
  $$,
  'P0001',
  'appointment_link_invalid',
  'a revoked receipt token cannot create a new session'
);

select * from finish();
rollback;
