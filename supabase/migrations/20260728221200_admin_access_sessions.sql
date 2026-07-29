set lock_timeout = '5s';
set statement_timeout = '60s';

create table private.admin_access_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  recently_reauthenticated_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  revoked_reason text check (
    revoked_reason is null or char_length(revoked_reason) between 2 and 120
  ),
  constraint admin_access_session_times_are_valid check (
    created_at <= last_seen_at
    and last_seen_at < idle_expires_at
    and idle_expires_at <= absolute_expires_at
    and absolute_expires_at <= created_at + interval '12 hours'
    and recently_reauthenticated_at >= created_at
  ),
  constraint admin_access_session_revocation_is_valid check (
    (revoked_at is null and revoked_reason is null)
    or (
      revoked_at is not null
      and revoked_at >= created_at
      and revoked_reason is not null
    )
  )
);

create index admin_access_sessions_user_active_idx
  on private.admin_access_sessions (user_id, absolute_expires_at desc)
  where revoked_at is null;

create index admin_access_sessions_expiry_idx
  on private.admin_access_sessions (absolute_expires_at);

revoke all on table private.admin_access_sessions
  from public, anon, authenticated, service_role;

create or replace function private.current_auth_session_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session_id text;
begin
  v_session_id := auth.jwt() ->> 'session_id';

  if v_session_id is null
    or v_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return null;
  end if;

  return v_session_id::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

revoke all on function private.current_auth_session_id()
  from public, anon, authenticated, service_role;

create or replace function public.current_admin_session_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and public.has_role(auth.uid(), 'admin'::public.app_role)
    and public.current_session_is_aal2()
    and private.current_auth_session_id() is not null
    and exists (
      select 1
      from private.admin_access_sessions as admin_session
      where admin_session.session_id = private.current_auth_session_id()
        and admin_session.user_id = auth.uid()
        and admin_session.revoked_at is null
        and admin_session.idle_expires_at > statement_timestamp()
        and admin_session.absolute_expires_at > statement_timestamp()
    );
$$;

revoke all on function public.current_admin_session_is_active()
  from public, anon, authenticated, service_role;
grant execute on function public.current_admin_session_is_active()
  to authenticated;

create or replace function public.register_or_touch_admin_session(
  p_request_id uuid
)
returns table (
  idle_expires_at timestamptz,
  absolute_expires_at timestamptz,
  recently_reauthenticated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session_id uuid := private.current_auth_session_id();
  v_existing private.admin_access_sessions%rowtype;
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'admin'::public.app_role)
    or not public.current_session_is_aal2()
    or v_session_id is null
  then
    raise exception 'insufficient privileges'
      using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('admin-session:' || auth.uid()::text, 0)
  );

  select *
  into v_existing
  from private.admin_access_sessions as admin_session
  where admin_session.session_id = v_session_id
  for update;

  if found then
    if v_existing.user_id <> auth.uid()
      or v_existing.revoked_at is not null
      or v_existing.idle_expires_at <= v_now
      or v_existing.absolute_expires_at <= v_now
    then
      update private.admin_access_sessions
      set
        revoked_at = coalesce(revoked_at, v_now),
        revoked_reason = coalesce(revoked_reason, 'expired_or_invalid')
      where session_id = v_session_id;

      raise exception 'admin session expired'
        using errcode = '42501';
    end if;

    update private.admin_access_sessions as admin_session
    set
      last_seen_at = v_now,
      idle_expires_at = least(
        v_now + interval '30 minutes',
        admin_session.absolute_expires_at
      )
    where admin_session.session_id = v_session_id
    returning
      admin_session.idle_expires_at,
      admin_session.absolute_expires_at,
      admin_session.recently_reauthenticated_at
    into
      idle_expires_at,
      absolute_expires_at,
      recently_reauthenticated_at;

    return next;
    return;
  end if;

  update private.admin_access_sessions
  set
    revoked_at = v_now,
    revoked_reason = 'superseded_by_new_session'
  where user_id = auth.uid()
    and revoked_at is null
    and absolute_expires_at > v_now;

  insert into private.admin_access_sessions as admin_session (
    session_id,
    user_id,
    created_at,
    last_seen_at,
    idle_expires_at,
    absolute_expires_at,
    recently_reauthenticated_at
  )
  values (
    v_session_id,
    auth.uid(),
    v_now,
    v_now,
    v_now + interval '30 minutes',
    v_now + interval '12 hours',
    v_now
  )
  returning
    admin_session.idle_expires_at,
    admin_session.absolute_expires_at,
    admin_session.recently_reauthenticated_at
  into
    idle_expires_at,
    absolute_expires_at,
    recently_reauthenticated_at;

  perform private.write_admin_audit(
    'admin_session.registered',
    'admin_access_session',
    v_session_id::text,
    '{}'::jsonb,
    p_request_id
  );

  return next;
end;
$$;

create or replace function public.mark_admin_session_reauthenticated(
  p_request_id uuid
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_session_id uuid := private.current_auth_session_id();
begin
  if not public.current_admin_session_is_active()
    or v_session_id is null
  then
    raise exception 'insufficient privileges'
      using errcode = '42501';
  end if;

  update private.admin_access_sessions
  set recently_reauthenticated_at = v_now
  where session_id = v_session_id
    and user_id = auth.uid()
    and revoked_at is null;

  if not found then
    raise exception 'admin session not found'
      using errcode = '42501';
  end if;

  perform private.write_admin_audit(
    'admin_session.reauthenticated',
    'admin_access_session',
    v_session_id::text,
    '{}'::jsonb,
    p_request_id
  );

  return v_now;
end;
$$;

create or replace function public.revoke_current_admin_session(
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
  v_session_id uuid := private.current_auth_session_id();
begin
  if auth.uid() is null
    or v_session_id is null
  then
    return;
  end if;

  update private.admin_access_sessions
  set
    revoked_at = coalesce(revoked_at, v_now),
    revoked_reason = coalesce(revoked_reason, 'admin_logout')
  where session_id = v_session_id
    and user_id = auth.uid();

  if found then
    perform private.write_admin_audit(
      'admin_session.revoked',
      'admin_access_session',
      v_session_id::text,
      '{"reason":"admin_logout"}'::jsonb,
      p_request_id
    );
  end if;
end;
$$;

revoke all on function public.register_or_touch_admin_session(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_admin_session_reauthenticated(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_current_admin_session(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.register_or_touch_admin_session(uuid)
  to authenticated;
grant execute on function public.mark_admin_session_reauthenticated(uuid)
  to authenticated;
grant execute on function public.revoke_current_admin_session(uuid)
  to authenticated;

create or replace function private.assert_admin_aal2()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_admin_session_is_active() then
    raise exception 'insufficient privileges'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_admin_aal2()
  from public, anon, authenticated, service_role;

drop policy providers_admin_select on public.providers;
create policy providers_admin_select
on public.providers
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy services_admin_select on public.services;
create policy services_admin_select
on public.services
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy gallery_items_admin_select on public.gallery_items;
create policy gallery_items_admin_select
on public.gallery_items
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy testimonials_admin_select on public.testimonials;
create policy testimonials_admin_select
on public.testimonials
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy faq_items_admin_select on public.faq_items;
create policy faq_items_admin_select
on public.faq_items
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy site_settings_admin_select on public.site_settings;
create policy site_settings_admin_select
on public.site_settings
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy policy_documents_admin_select on public.policy_documents;
create policy policy_documents_admin_select
on public.policy_documents
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy business_hours_admin_select on public.business_hours;
create policy business_hours_admin_select
on public.business_hours
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy schedule_exceptions_admin_select on public.schedule_exceptions;
create policy schedule_exceptions_admin_select
on public.schedule_exceptions
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy availability_blocks_admin_select on public.availability_blocks;
create policy availability_blocks_admin_select
on public.availability_blocks
for select
to authenticated
using (public.current_admin_session_is_active());

drop policy contact_messages_admin_select on public.contact_messages;
create policy contact_messages_admin_select
on public.contact_messages
for select
to authenticated
using (public.current_admin_session_is_active());
