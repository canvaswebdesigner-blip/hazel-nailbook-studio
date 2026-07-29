begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(36);

insert into public.policy_documents (
  id,
  policy_type,
  version,
  content,
  content_sha256,
  published_at,
  is_current
)
values (
  '40000000-0000-0000-0000-000000000001',
  'privacy_notice',
  'contact-v1',
  repeat('İletişim formu gizlilik bildirimi test içeriğidir. ', 3),
  repeat('4', 64),
  statement_timestamp(),
  true
);

select ok(
  to_regprocedure(
    'public.submit_public_contact_message(uuid,text,text,text,text,text,text,text,text,text,uuid)'
  ) is not null,
  'the reviewed public contact submission RPC exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.submit_public_contact_message(uuid,text,text,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute contact submission directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_public_contact_message(uuid,text,text,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated callers cannot execute contact submission directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.submit_public_contact_message(uuid,text,text,text,text,text,text,text,text,text,uuid)',
    'EXECUTE'
  ),
  'service role may execute the reviewed contact entry point'
);
select ok(
  not has_table_privilege('anon', 'public.contact_messages', 'INSERT'),
  'anonymous callers cannot insert contact messages directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.contact_messages', 'INSERT'),
  'authenticated callers cannot insert contact messages directly'
);
select ok(
  not has_table_privilege('service_role', 'public.contact_messages', 'INSERT'),
  'service role cannot bypass the reviewed contact RPC'
);

create temporary table contact_result as
select *
from public.submit_public_contact_message(
  '40000000-0000-0000-0000-000000000010',
  '  İpek   Yılmaz  ',
  '+905551112244',
  'IPEK@EXAMPLE.COM',
  'Randevu öncesi özel bir uygulama hakkında bilgi almak istiyorum.',
  'contact-v1',
  repeat('a', 64),
  'pgTAP contact form',
  repeat('b', 64),
  repeat('c', 64),
  '40000000-0000-0000-0000-000000000011'
);

select is(
  (select result_kind from contact_result),
  'created',
  'a valid submission reports a created result'
);
select is(
  (select contact_message_id from contact_result),
  '40000000-0000-0000-0000-000000000010'::uuid,
  'a valid submission returns its contact message identifier'
);
select is(
  (
    select full_name
    from public.contact_messages
    where id = '40000000-0000-0000-0000-000000000010'
  ),
  'İpek Yılmaz',
  'the RPC normalizes repeated name whitespace'
);
select is(
  (
    select email
    from public.contact_messages
    where id = '40000000-0000-0000-0000-000000000010'
  ),
  'ipek@example.com',
  'the RPC normalizes email casing'
);
select is(
  (
    select phone_e164
    from public.contact_messages
    where id = '40000000-0000-0000-0000-000000000010'
  ),
  '+905551112244',
  'the RPC stores the normalized phone number'
);
select is(
  (
    select message
    from public.contact_messages
    where id = '40000000-0000-0000-0000-000000000010'
  ),
  'Randevu öncesi özel bir uygulama hakkında bilgi almak istiyorum.',
  'the RPC stores the submitted message'
);
select is(
  (
    select privacy_notice_version
    from public.contact_messages
    where id = '40000000-0000-0000-0000-000000000010'
  ),
  'contact-v1',
  'the accepted privacy notice version is persisted'
);
select is(
  (
    select status::text
    from public.contact_messages
    where id = '40000000-0000-0000-0000-000000000010'
  ),
  'new',
  'new contact submissions enter the inbox as new'
);
select ok(
  (
    select consented_at is not null
    from public.contact_messages
    where id = '40000000-0000-0000-0000-000000000010'
  ),
  'the contact record persists consent time'
);
select is(
  (
    select user_agent
    from private.contact_submission_metadata
    where contact_message_id = '40000000-0000-0000-0000-000000000010'
  ),
  'pgTAP contact form',
  'technical metadata stores the bounded user agent separately'
);
select is(
  (
    select expires_at - created_at
    from private.contact_submission_metadata
    where contact_message_id = '40000000-0000-0000-0000-000000000010'
  ),
  interval '30 days',
  'technical contact metadata expires after thirty days'
);
select is(
  (
    select count(*)::integer
    from private.admin_notifications
    where entity_id = '40000000-0000-0000-0000-000000000010'
      and notification_type = 'contact_message_received'
  ),
  1,
  'contact submission creates one admin notification'
);
select is(
  (
    select count(*)::integer
    from private.audit_logs
    where entity_id = '40000000-0000-0000-0000-000000000010'
      and action = 'contact_message.created'
  ),
  1,
  'contact submission creates one audit event'
);
select ok(
  (
    select not (
      metadata ? 'phone'
      or metadata ? 'email'
      or metadata ? 'message'
      or metadata ? 'full_name'
    )
    from private.audit_logs
    where entity_id = '40000000-0000-0000-0000-000000000010'
      and action = 'contact_message.created'
  ),
  'contact audit metadata contains no message or direct contact details'
);
select ok(
  (
    select
      result_payload ? 'contact_message_id'
      and not private.jsonb_contains_sensitive_key(result_payload)
    from private.idempotency_keys
    where scope = 'public_contact'
      and key_hmac = repeat('b', 64)
  ),
  'the idempotent result is useful and contains no private credential'
);

create temporary table contact_replay as
select *
from public.submit_public_contact_message(
  '40000000-0000-0000-0000-000000000012',
  'İpek Yılmaz',
  '+905551112244',
  'ipek@example.com',
  'Randevu öncesi özel bir uygulama hakkında bilgi almak istiyorum.',
  'contact-v1',
  repeat('a', 64),
  'pgTAP contact form',
  repeat('b', 64),
  repeat('c', 64),
  '40000000-0000-0000-0000-000000000013'
);

select is(
  (select result_kind from contact_replay),
  'replayed',
  'an identical idempotent retry reports a replay'
);
select is(
  (select contact_message_id from contact_replay),
  '40000000-0000-0000-0000-000000000010'::uuid,
  'an identical idempotent retry returns the original message'
);

select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000014',
      'İpek Yılmaz',
      '+905551112244',
      'ipek@example.com',
      'Aynı anahtar farklı bir mesajla yeniden kullanılıyor.',
      'contact-v1',
      null,
      null,
      repeat('b', 64),
      repeat('d', 64),
      '40000000-0000-0000-0000-000000000015'
    )
  $$,
  '22023',
  'idempotency_key_reuse',
  'an idempotency key cannot be reused for different semantic input'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000016',
      'Test Müşteri',
      '+905551112255',
      null,
      'Güncel olmayan politika sürümüyle gönderilen test mesajıdır.',
      'outdated-v1',
      null,
      null,
      repeat('e', 64),
      repeat('f', 64),
      '40000000-0000-0000-0000-000000000017'
    )
  $$,
  '22023',
  'privacy_notice_outdated',
  'an outdated privacy notice is rejected'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000018',
      'Test Müşteri',
      null,
      null,
      'İletişim bilgisi olmayan bu test mesajı reddedilmelidir.',
      'contact-v1',
      null,
      null,
      repeat('1', 64),
      repeat('2', 64),
      '40000000-0000-0000-0000-000000000019'
    )
  $$,
  '22023',
  'contact_request_invalid',
  'a message without phone or email is rejected'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000020',
      'Test Müşteri',
      null,
      'not-an-email',
      'Geçersiz e-posta adresi içeren bu mesaj reddedilmelidir.',
      'contact-v1',
      null,
      null,
      repeat('3', 64),
      repeat('4', 64),
      '40000000-0000-0000-0000-000000000021'
    )
  $$,
  '22023',
  'contact_request_invalid',
  'an invalid email address is rejected by the RPC boundary'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000022',
      'Test Müşteri',
      '0555',
      null,
      'Geçersiz telefon numarası içeren bu mesaj reddedilmelidir.',
      'contact-v1',
      null,
      null,
      repeat('5', 64),
      repeat('6', 64),
      '40000000-0000-0000-0000-000000000023'
    )
  $$,
  '22023',
  'contact_request_invalid',
  'an invalid phone number is rejected by the RPC boundary'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000024',
      'Test Müşteri',
      '+905551112266',
      null,
      'Kısa',
      'contact-v1',
      null,
      null,
      repeat('7', 64),
      repeat('8', 64),
      '40000000-0000-0000-0000-000000000025'
    )
  $$,
  '22023',
  'contact_request_invalid',
  'a message shorter than ten characters is rejected'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000026',
      'Test Müşteri',
      '+905551112277',
      null,
      'Bozuk idempotency anahtarı içeren bu mesaj reddedilmelidir.',
      'contact-v1',
      null,
      null,
      'not-a-hmac',
      repeat('9', 64),
      '40000000-0000-0000-0000-000000000027'
    )
  $$,
  '22023',
  'contact_request_invalid',
  'a malformed idempotency HMAC is rejected'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000010',
      'Başka Müşteri',
      '+905551112288',
      null,
      'Mevcut UUID ile farklı bir mesaj oluşturulamaz.',
      'contact-v1',
      null,
      null,
      repeat('0', 64),
      repeat('a', 64),
      '40000000-0000-0000-0000-000000000028'
    )
  $$,
  '22023',
  'contact_message_id_unavailable',
  'an existing contact UUID cannot be reused'
);
select is(
  (
    select count(*)::integer
    from private.idempotency_keys
    where scope = 'public_contact'
      and key_hmac = repeat('e', 64)
  ),
  0,
  'a rejected policy version leaves no idempotency record'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000029',
      'Test Müşteri',
      '+905551112299',
      null,
      'Eksik request UUID içeren bu mesaj reddedilmelidir.',
      'contact-v1',
      null,
      null,
      repeat('d', 64),
      repeat('e', 64),
      null
    )
  $$,
  '22023',
  'contact_request_invalid',
  'a missing request identifier is rejected'
);
select throws_ok(
  $$
    select *
    from public.submit_public_contact_message(
      '40000000-0000-0000-0000-000000000030',
      'Test Müşteri',
      '+905551113300',
      null,
      'Çok uzun user-agent değeri içeren mesaj reddedilmelidir.',
      'contact-v1',
      null,
      repeat('u', 513),
      repeat('f', 64),
      repeat('0', 64),
      '40000000-0000-0000-0000-000000000031'
    )
  $$,
  '22023',
  'contact_request_invalid',
  'an oversized user agent is rejected'
);
select is(
  (
    select count(*)::integer
    from public.contact_messages
    where id = '40000000-0000-0000-0000-000000000010'
  ),
  1,
  'validation and replay attempts never duplicate the original contact message'
);

select * from finish();
rollback;
