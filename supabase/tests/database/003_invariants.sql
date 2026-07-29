begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(17);

select ok(
  private.jsonb_contains_sensitive_key(
    '{"safe":{"nested":{"management_token":"secret"}}}'::jsonb
  ),
  'nested token keys are detected'
);
select ok(
  not private.jsonb_contains_sensitive_key(
    '{"booking_code":"ABCD2345","status":"confirmed"}'::jsonb
  ),
  'safe idempotency payload is accepted'
);

select lives_ok(
  $$
    insert into public.providers (id, display_name, is_active)
    values ('00000000-0000-0000-0000-000000000001', 'Hazel', true)
  $$,
  'first active provider can be created'
);
select throws_ok(
  $$
    insert into public.providers (id, display_name, is_active)
    values ('00000000-0000-0000-0000-000000000002', 'Other', true)
  $$,
  '23505',
  null,
  'a second active provider is rejected'
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
  duration_minutes
)
values (
  '00000000-0000-0000-0000-000000000010',
  'Kalıcı Oje',
  'kalici-oje',
  'Test hizmeti açıklaması.',
  'Test amacıyla kullanılan yeterince uzun hizmet açıklaması.',
  'Bakım',
  1000,
  'fixed',
  60
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
    '00000000-0000-0000-0000-000000000020',
    'privacy_notice',
    'v1',
    repeat('Gizlilik bildirimi test içeriği. ', 3),
    repeat('a', 64),
    statement_timestamp(),
    true
  ),
  (
    '00000000-0000-0000-0000-000000000021',
    'booking_terms',
    'v1',
    repeat('Randevu koşulları test içeriği. ', 3),
    repeat('b', 64),
    statement_timestamp(),
    true
  );

insert into public.customers (
  id,
  full_name,
  phone_e164
)
values (
  '00000000-0000-0000-0000-000000000030',
  'Test Müşteri',
  '+905551112233'
);

select lives_ok(
  $$
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
    values (
      '00000000-0000-0000-0000-000000000040',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000030',
      '00000000-0000-0000-0000-000000000010',
      'ABCD2345',
      1,
      repeat('c', 64),
      statement_timestamp() + interval '30 days',
      repeat('d', 64),
      statement_timestamp() + interval '30 days',
      'Kalıcı Oje',
      1000,
      'fixed',
      'TRY',
      60,
      15,
      15,
      '2030-01-10 10:00:00+03',
      '2030-01-10 11:00:00+03',
      '2030-01-10 09:45:00+03',
      '2030-01-10 11:15:00+03',
      'confirmed',
      'public_booking',
      '00000000-0000-0000-0000-000000000020',
      'v1',
      '00000000-0000-0000-0000-000000000021',
      'v1',
      statement_timestamp(),
      'web'
    )
  $$,
  'a valid confirmed appointment can be created'
);
select throws_ok(
  $$
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
    values (
      '00000000-0000-0000-0000-000000000041',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000030',
      '00000000-0000-0000-0000-000000000010',
      'ABCD2346',
      1,
      repeat('e', 64),
      statement_timestamp() + interval '30 days',
      repeat('f', 64),
      statement_timestamp() + interval '30 days',
      'Kalıcı Oje',
      1000,
      'fixed',
      'TRY',
      60,
      15,
      15,
      '2030-01-10 10:30:00+03',
      '2030-01-10 11:30:00+03',
      '2030-01-10 10:15:00+03',
      '2030-01-10 11:45:00+03',
      'confirmed',
      'public_booking',
      '00000000-0000-0000-0000-000000000020',
      'v1',
      '00000000-0000-0000-0000-000000000021',
      'v1',
      statement_timestamp(),
      'web'
    )
  $$,
  '23P01',
  null,
  'overlapping confirmed appointments are rejected'
);
select is(
  (
    select row_version
    from public.appointments
    where id = '00000000-0000-0000-0000-000000000040'
  ),
  0::bigint,
  'new appointment starts at row version zero'
);
select lives_ok(
  $$
    update public.appointments
    set receipt_token_revoked_at = statement_timestamp()
    where id = '00000000-0000-0000-0000-000000000040'
  $$,
  'receipt token can be revoked once'
);
select throws_ok(
  $$
    update public.appointments
    set receipt_token_revoked_at = null
    where id = '00000000-0000-0000-0000-000000000040'
  $$,
  '23514',
  null,
  'receipt-token revocation cannot be reversed'
);
select throws_ok(
  $$
    update public.appointments
    set management_token_hash = repeat('1', 64)
    where id = '00000000-0000-0000-0000-000000000040'
  $$,
  '23514',
  null,
  'management hash cannot change without a version increment'
);
select throws_ok(
  $$
    update public.appointments
    set quoted_price = 1200
    where id = '00000000-0000-0000-0000-000000000040'
  $$,
  '23514',
  null,
  'service snapshots cannot change without an explicit RPC context'
);
select throws_ok(
  $$
    insert into public.contact_messages (
      full_name,
      email,
      message,
      privacy_notice_id,
      privacy_notice_version,
      consented_at
    )
    values (
      'Test Müşteri',
      'test@example.com',
      'Bu yeterince uzun bir test iletişim mesajıdır.',
      '00000000-0000-0000-0000-000000000021',
      'v1',
      statement_timestamp()
    )
  $$,
  '23503',
  null,
  'contact consent cannot reference a booking-terms document'
);
select lives_ok(
  $$
    insert into public.contact_messages (
      full_name,
      email,
      message,
      privacy_notice_id,
      privacy_notice_version,
      consented_at
    )
    values (
      'Test Müşteri',
      'test@example.com',
      'Bu yeterince uzun bir test iletişim mesajıdır.',
      '00000000-0000-0000-0000-000000000020',
      'v1',
      statement_timestamp()
    )
  $$,
  'contact consent accepts the current privacy document'
);
select is(
  private.provider_date_lock_key(
    '00000000-0000-0000-0000-000000000001',
    date '2030-01-10'
  ),
  private.provider_date_lock_key(
    '00000000-0000-0000-0000-000000000001',
    date '2030-01-10'
  ),
  'provider/date lock key is deterministic'
);
select ok(
  private.provider_date_lock_key(
    '00000000-0000-0000-0000-000000000001',
    date '2030-01-10'
  )
  <> private.provider_date_lock_key(
    '00000000-0000-0000-0000-000000000001',
    date '2030-01-11'
  ),
  'different local dates use different lock keys'
);
select is(
  private.local_dates_for_range(
    '2030-01-10 00:00:00+03',
    '2030-01-13 00:00:00+03'
  ),
  array[date '2030-01-10', date '2030-01-11', date '2030-01-12'],
  'a multi-day half-open range locks every affected local date'
);
select throws_ok(
  $$
    select private.local_dates_for_range(
      '2030-01-10 00:00:00+03',
      '2032-01-10 00:00:00+03'
    )
  $$,
  '22023',
  null,
  'an unbounded date-lock range fails closed'
);

select * from finish();
rollback;
