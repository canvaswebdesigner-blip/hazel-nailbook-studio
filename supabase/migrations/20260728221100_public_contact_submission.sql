set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.submit_public_contact_message(
  p_contact_message_id uuid,
  p_full_name text,
  p_phone_e164 text,
  p_email text,
  p_message text,
  p_privacy_notice_version text,
  p_ip_hmac text,
  p_user_agent text,
  p_idempotency_key_hmac text,
  p_request_fingerprint text,
  p_request_id uuid
)
returns table (
  result_kind text,
  contact_message_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_normalized_name text := pg_catalog.regexp_replace(
    pg_catalog.btrim(coalesce(p_full_name, '')),
    '\s+',
    ' ',
    'g'
  );
  v_normalized_email text := nullif(
    pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))),
    ''
  );
  v_normalized_message text := pg_catalog.btrim(coalesce(p_message, ''));
  v_normalized_user_agent text := nullif(
    pg_catalog.btrim(coalesce(p_user_agent, '')),
    ''
  );
  v_privacy_notice_id uuid;
  v_idempotency_inserted integer;
  v_idempotency private.idempotency_keys%rowtype;
begin
  if p_contact_message_id is null
    or char_length(v_normalized_name) not between 2 and 100
    or (
      p_phone_e164 is not null
      and p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$'
    )
    or (
      v_normalized_email is not null
      and (
        char_length(v_normalized_email) not between 3 and 320
        or v_normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    )
    or (p_phone_e164 is null and v_normalized_email is null)
    or char_length(v_normalized_message) not between 10 and 3000
    or p_privacy_notice_version is null
    or char_length(p_privacy_notice_version) not between 1 and 50
    or (p_ip_hmac is not null and p_ip_hmac !~ '^[0-9a-f]{64}$')
    or (
      v_normalized_user_agent is not null
      and char_length(v_normalized_user_agent) > 512
    )
    or p_idempotency_key_hmac is null
    or p_idempotency_key_hmac !~ '^[0-9a-f]{64}$'
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_request_id is null
  then
    raise exception 'contact_request_invalid'
      using errcode = '22023';
  end if;

  delete from private.idempotency_keys as idempotency
  where idempotency.scope = 'public_contact'
    and idempotency.key_hmac = p_idempotency_key_hmac
    and idempotency.expires_at <= v_now;

  insert into private.idempotency_keys (
    scope,
    key_hmac,
    request_fingerprint,
    expires_at
  )
  values (
    'public_contact',
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
    where idempotency.scope = 'public_contact'
      and idempotency.key_hmac = p_idempotency_key_hmac;

    if v_idempotency.request_fingerprint is distinct from p_request_fingerprint then
      raise exception 'idempotency_key_reuse'
        using errcode = '22023';
    end if;

    if not (v_idempotency.result_payload ? 'contact_message_id') then
      raise exception 'idempotency_result_unavailable'
        using errcode = '40001';
    end if;

    contact_message_id := (
      v_idempotency.result_payload ->> 'contact_message_id'
    )::uuid;

    if not exists (
      select 1
      from public.contact_messages as contact
      where contact.id = contact_message_id
    )
    then
      raise exception 'idempotency_result_unavailable'
        using errcode = '40001';
    end if;

    result_kind := 'replayed';
    return next;
    return;
  end if;

  if exists (
    select 1
    from public.contact_messages as contact
    where contact.id = p_contact_message_id
  )
  then
    raise exception 'contact_message_id_unavailable'
      using errcode = '22023';
  end if;

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

  insert into public.contact_messages (
    id,
    full_name,
    phone_e164,
    email,
    message,
    privacy_notice_id,
    privacy_notice_version,
    consented_at,
    status
  )
  values (
    p_contact_message_id,
    v_normalized_name,
    p_phone_e164,
    v_normalized_email,
    v_normalized_message,
    v_privacy_notice_id,
    p_privacy_notice_version,
    v_now,
    'new'
  );

  insert into private.contact_submission_metadata (
    contact_message_id,
    ip_hmac,
    user_agent,
    created_at,
    expires_at
  )
  values (
    p_contact_message_id,
    p_ip_hmac,
    v_normalized_user_agent,
    v_now,
    v_now + interval '30 days'
  );

  insert into private.admin_notifications (
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    'contact_message_received',
    'contact_message',
    p_contact_message_id::text,
    'Yeni iletişim mesajı',
    'Web sitesi iletişim formundan yeni bir mesaj geldi.'
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
    'contact_message.created',
    'contact_message',
    p_contact_message_id::text,
    pg_catalog.jsonb_build_object(
      'source',
      'public_contact_form',
      'has_phone',
      p_phone_e164 is not null,
      'has_email',
      v_normalized_email is not null
    ),
    p_request_id
  );

  update private.idempotency_keys as idempotency
  set result_payload = pg_catalog.jsonb_build_object(
    'contact_message_id',
    p_contact_message_id
  )
  where idempotency.scope = 'public_contact'
    and idempotency.key_hmac = p_idempotency_key_hmac;

  result_kind := 'created';
  contact_message_id := p_contact_message_id;
  return next;
end;
$$;

revoke all on function public.submit_public_contact_message(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function public.submit_public_contact_message(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid
) to service_role;
