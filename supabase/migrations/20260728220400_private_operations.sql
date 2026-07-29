set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function private.jsonb_contains_sensitive_key(p_value jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_key text;
  v_child jsonb;
begin
  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in
      select entry.key, entry.value
      from jsonb_each(p_value) as entry
    loop
      if lower(v_key) like '%token%'
        or lower(v_key) in (
          'receipt_url',
          'management_url',
          'manage_url',
          'private_url'
        )
      then
        return true;
      end if;

      if private.jsonb_contains_sensitive_key(v_child) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_child in
      select item.value
      from jsonb_array_elements(p_value) as item
    loop
      if private.jsonb_contains_sensitive_key(v_child) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

revoke all on function private.jsonb_contains_sensitive_key(jsonb)
  from public, anon, authenticated, service_role;

create table private.idempotency_keys (
  scope text not null check (scope ~ '^[a-z][a-z0-9_]{1,79}$'),
  key_hmac text not null check (key_hmac ~ '^[0-9a-f]{64}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  result_appointment_id uuid references public.appointments (id) on delete set null,
  result_management_token_version integer check (
    result_management_token_version is null or result_management_token_version > 0
  ),
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  primary key (scope, key_hmac),
  constraint idempotency_result_payload_is_object check (
    jsonb_typeof(result_payload) = 'object'
  ),
  constraint idempotency_result_payload_has_no_private_credentials check (
    not private.jsonb_contains_sensitive_key(result_payload)
  ),
  constraint idempotency_expiry_is_future check (expires_at > created_at)
);

create index idempotency_keys_expiry_idx
  on private.idempotency_keys (expires_at);

create table private.rate_limit_counters (
  scope text not null check (scope ~ '^[a-z][a-z0-9_]{1,79}$'),
  bucket_hmac text not null check (bucket_hmac ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 86400),
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  primary key (scope, bucket_hmac, window_start),
  constraint rate_limit_expiry_matches_window check (
    expires_at >= window_start + window_seconds * interval '1 second'
  )
);

create index rate_limit_counters_expiry_idx
  on private.rate_limit_counters (expires_at);

create table private.appointment_access_sessions (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  scope private.appointment_access_scope not null,
  created_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  sliding_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint appointment_access_session_times_are_valid check (
    created_at <= last_seen_at
    and last_seen_at < sliding_expires_at
    and sliding_expires_at <= absolute_expires_at
    and absolute_expires_at <= created_at + interval '2 hours'
  ),
  constraint appointment_access_session_revocation_is_valid check (
    revoked_at is null or revoked_at >= created_at
  )
);

create index appointment_access_sessions_appointment_scope_idx
  on private.appointment_access_sessions (appointment_id, scope)
  where revoked_at is null;

create index appointment_access_sessions_expiry_idx
  on private.appointment_access_sessions (absolute_expires_at);

create table private.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_type text not null check (
    actor_type in ('admin', 'customer', 'public', 'system')
  ),
  action text not null check (action ~ '^[a-z][a-z0-9_.]{1,119}$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{1,79}$'),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  request_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  constraint audit_metadata_is_object check (jsonb_typeof(metadata) = 'object'),
  constraint audit_entity_id_length check (
    entity_id is null or char_length(entity_id) <= 200
  )
);

create index audit_logs_entity_idx
  on private.audit_logs (entity_type, entity_id, created_at desc);

create index audit_logs_created_at_idx
  on private.audit_logs (created_at desc);

create table private.admin_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  notification_type text not null check (
    notification_type ~ '^[a-z][a-z0-9_]{1,79}$'
  ),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{1,79}$'),
  entity_id text,
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 2 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint admin_notification_entity_id_length check (
    entity_id is null or char_length(entity_id) <= 200
  ),
  constraint admin_notification_read_time_is_valid check (
    read_at is null or read_at >= created_at
  )
);

create index admin_notifications_unread_idx
  on private.admin_notifications (created_at desc)
  where read_at is null;

create table private.contact_submission_metadata (
  contact_message_id uuid primary key
    references public.contact_messages (id) on delete cascade,
  ip_hmac text check (ip_hmac is null or ip_hmac ~ '^[0-9a-f]{64}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  constraint contact_submission_metadata_expiry_is_future check (
    expires_at > created_at
  )
);

create index contact_submission_metadata_expiry_idx
  on private.contact_submission_metadata (expires_at);

revoke all on all tables in schema private
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema private
  from public, anon, authenticated, service_role;
