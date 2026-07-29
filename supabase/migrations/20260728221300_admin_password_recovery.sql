set lock_timeout = '5s';
set statement_timeout = '60s';

create table private.admin_recovery_sessions (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  request_id uuid,
  constraint admin_recovery_session_expiry_is_valid check (
    expires_at > created_at
    and expires_at <= created_at + interval '15 minutes'
  ),
  constraint admin_recovery_session_consumption_is_valid check (
    consumed_at is null or consumed_at >= created_at
  )
);

create index admin_recovery_sessions_user_active_idx
  on private.admin_recovery_sessions (user_id, expires_at desc)
  where consumed_at is null;

create index admin_recovery_sessions_expiry_idx
  on private.admin_recovery_sessions (expires_at);

revoke all on table private.admin_recovery_sessions
  from public, anon, authenticated, service_role;

create or replace function public.register_admin_recovery_session(
  p_session_hash text,
  p_request_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'admin'::public.app_role)
    or p_session_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'insufficient privileges'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admin-recovery:' || auth.uid()::text, 0)
  );

  update private.admin_recovery_sessions
  set consumed_at = v_now
  where user_id = auth.uid()
    and consumed_at is null;

  insert into private.admin_recovery_sessions (
    session_hash,
    user_id,
    created_at,
    expires_at,
    request_id
  )
  values (
    p_session_hash,
    auth.uid(),
    v_now,
    v_now + interval '15 minutes',
    p_request_id
  );

  perform private.write_admin_audit(
    'admin_password_recovery.registered',
    'admin_recovery_session',
    null,
    '{}'::jsonb,
    p_request_id
  );
end;
$$;

create or replace function public.current_admin_recovery_session_is_valid(
  p_session_hash text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.has_role(auth.uid(), 'admin'::public.app_role)
    and p_session_hash ~ '^[0-9a-f]{64}$'
    and exists (
      select 1
      from private.admin_recovery_sessions as recovery_session
      where recovery_session.session_hash = p_session_hash
        and recovery_session.user_id = auth.uid()
        and recovery_session.consumed_at is null
        and recovery_session.expires_at > statement_timestamp()
    );
$$;

create or replace function public.consume_admin_recovery_session(
  p_session_hash text,
  p_request_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_recovery private.admin_recovery_sessions%rowtype;
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'admin'::public.app_role)
    or p_session_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'insufficient privileges'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admin-recovery:' || auth.uid()::text, 0)
  );

  select *
  into v_recovery
  from private.admin_recovery_sessions as recovery_session
  where recovery_session.session_hash = p_session_hash
    and recovery_session.user_id = auth.uid()
  for update;

  if not found
    or v_recovery.consumed_at is not null
    or v_recovery.expires_at <= v_now
  then
    raise exception 'recovery session is invalid'
      using errcode = '42501';
  end if;

  update private.admin_recovery_sessions
  set consumed_at = v_now
  where session_hash = p_session_hash;

  update private.admin_access_sessions
  set
    revoked_at = coalesce(revoked_at, v_now),
    revoked_reason = coalesce(revoked_reason, 'password_reset')
  where user_id = auth.uid()
    and revoked_at is null;

  perform private.write_admin_audit(
    'admin_password_recovery.consumed',
    'admin_recovery_session',
    null,
    '{}'::jsonb,
    p_request_id
  );
end;
$$;

revoke all on function public.register_admin_recovery_session(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.current_admin_recovery_session_is_valid(text)
  from public, anon, authenticated, service_role;
revoke all on function public.consume_admin_recovery_session(text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.register_admin_recovery_session(text, uuid)
  to authenticated;
grant execute on function public.current_admin_recovery_session_is_valid(text)
  to authenticated;
grant execute on function public.consume_admin_recovery_session(text, uuid)
  to authenticated;
