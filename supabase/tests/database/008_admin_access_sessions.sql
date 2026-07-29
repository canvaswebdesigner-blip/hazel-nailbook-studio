begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(25);

select ok(
  to_regclass('private.admin_access_sessions') is not null,
  'private admin access sessions table exists'
);
select col_is_pk(
  'private',
  'admin_access_sessions',
  'session_id',
  'Supabase session id is the admin session primary key'
);
select columns_are(
  'private',
  'admin_access_sessions',
  array[
    'session_id',
    'user_id',
    'created_at',
    'last_seen_at',
    'idle_expires_at',
    'absolute_expires_at',
    'recently_reauthenticated_at',
    'revoked_at',
    'revoked_reason'
  ],
  'admin session stores idle, absolute and recent-reauthentication state'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.admin_access_sessions'::regclass
      and conname = 'admin_access_session_times_are_valid'
  ),
  'admin session timing constraint exists'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.admin_access_sessions'::regclass
      and conname = 'admin_access_session_revocation_is_valid'
  ),
  'admin session revocation constraint exists'
);
select ok(
  to_regprocedure('private.current_auth_session_id()') is not null,
  'private JWT session-id helper exists'
);
select ok(
  to_regprocedure('public.current_admin_session_is_active()') is not null,
  'active admin-session predicate exists'
);
select ok(
  to_regprocedure('public.register_or_touch_admin_session(uuid)') is not null,
  'admin session registration RPC exists'
);
select ok(
  to_regprocedure('public.mark_admin_session_reauthenticated(uuid)') is not null,
  'admin recent-reauthentication RPC exists'
);
select ok(
  to_regprocedure('public.revoke_current_admin_session(uuid)') is not null,
  'admin session revocation RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.current_admin_session_is_active()',
    'EXECUTE'
  ),
  'authenticated users may evaluate the guarded admin-session predicate'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.register_or_touch_admin_session(uuid)',
    'EXECUTE'
  ),
  'authenticated users may enter the role and AAL checked registration RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.mark_admin_session_reauthenticated(uuid)',
    'EXECUTE'
  ),
  'authenticated admins may enter the active-session reauthentication RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.revoke_current_admin_session(uuid)',
    'EXECUTE'
  ),
  'authenticated users may revoke their own admin session'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.register_or_touch_admin_session(uuid)',
    'EXECUTE'
  ),
  'anon cannot register an admin session'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.register_or_touch_admin_session(uuid)',
    'EXECUTE'
  ),
  'service role cannot bypass auth.uid based session registration'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.current_auth_session_id()',
    'EXECUTE'
  ),
  'authenticated users cannot call the private JWT helper directly'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.admin_access_sessions',
    'SELECT'
  ),
  'authenticated users cannot read private admin session rows'
);
select ok(
  not has_table_privilege(
    'service_role',
    'private.admin_access_sessions',
    'SELECT'
  ),
  'service role cannot read private admin session rows directly'
);
select ok(
  position(
    'current_admin_session_is_active'
    in pg_get_functiondef('private.assert_admin_aal2()'::regprocedure)
  ) > 0,
  'admin assertion requires an active registered session'
);
select ok(
  exists (
    select 1
    from pg_policy as policy
    where policy.polrelid = 'public.services'::regclass
      and policy.polname = 'services_admin_select'
      and position(
        'current_admin_session_is_active'
        in pg_get_expr(policy.polqual, policy.polrelid)
      ) > 0
  ),
  'service admin reads require an active registered session'
);
select ok(
  exists (
    select 1
    from pg_policy as policy
    where policy.polrelid = 'public.contact_messages'::regclass
      and policy.polname = 'contact_messages_admin_select'
      and position(
        'current_admin_session_is_active'
        in pg_get_expr(policy.polqual, policy.polrelid)
      ) > 0
  ),
  'contact-message admin reads require an active registered session'
);
select ok(
  position(
    'pg_advisory_xact_lock'
    in pg_get_functiondef(
      'public.register_or_touch_admin_session(uuid)'::regprocedure
    )
  ) > 0,
  'admin session registration serializes concurrent sessions'
);
select ok(
  position(
    'superseded_by_new_session'
    in pg_get_functiondef(
      'public.register_or_touch_admin_session(uuid)'::regprocedure
    )
  ) > 0,
  'new admin sessions revoke older active sessions'
);
select ok(
  position(
    '30 minutes'
    in pg_get_functiondef(
      'public.register_or_touch_admin_session(uuid)'::regprocedure
    )
  ) > 0
  and position(
    '12 hours'
    in pg_get_functiondef(
      'public.register_or_touch_admin_session(uuid)'::regprocedure
    )
  ) > 0,
  'admin session RPC enforces idle and absolute time limits'
);

select * from finish();
rollback;
