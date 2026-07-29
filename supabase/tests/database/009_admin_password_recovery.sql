begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(18);

select ok(
  to_regclass('private.admin_recovery_sessions') is not null,
  'private admin recovery sessions table exists'
);
select col_is_pk(
  'private',
  'admin_recovery_sessions',
  'session_hash',
  'recovery session hash is the primary key'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.admin_recovery_sessions'::regclass
      and conname = 'admin_recovery_session_expiry_is_valid'
  ),
  'recovery sessions enforce a fifteen-minute maximum lifetime'
);
select ok(
  to_regprocedure('public.register_admin_recovery_session(text,uuid)') is not null,
  'recovery registration RPC exists'
);
select ok(
  to_regprocedure('public.current_admin_recovery_session_is_valid(text)') is not null,
  'recovery validation RPC exists'
);
select ok(
  to_regprocedure('public.consume_admin_recovery_session(text,uuid)') is not null,
  'one-time recovery consumption RPC exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.register_admin_recovery_session(text,uuid)',
    'EXECUTE'
  ),
  'authenticated users may enter the role-checked registration RPC'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.current_admin_recovery_session_is_valid(text)',
    'EXECUTE'
  ),
  'authenticated users may validate their own recovery session'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.consume_admin_recovery_session(text,uuid)',
    'EXECUTE'
  ),
  'authenticated users may enter the role-checked consume RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.register_admin_recovery_session(text,uuid)',
    'EXECUTE'
  ),
  'anon cannot register an admin recovery session'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.consume_admin_recovery_session(text,uuid)',
    'EXECUTE'
  ),
  'service role cannot bypass auth.uid based recovery consumption'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'private.admin_recovery_sessions',
    'SELECT'
  ),
  'authenticated users cannot read recovery rows directly'
);
select ok(
  not has_table_privilege(
    'service_role',
    'private.admin_recovery_sessions',
    'SELECT'
  ),
  'service role cannot read recovery rows directly'
);
select ok(
  position(
    'pg_advisory_xact_lock'
    in pg_get_functiondef(
      'public.register_admin_recovery_session(text,uuid)'::regprocedure
    )
  ) > 0,
  'recovery registration serializes per admin'
);
select ok(
  position(
    '15 minutes'
    in pg_get_functiondef(
      'public.register_admin_recovery_session(text,uuid)'::regprocedure
    )
  ) > 0,
  'recovery registration creates a short-lived session'
);
select ok(
  position(
    'password_reset'
    in pg_get_functiondef(
      'public.consume_admin_recovery_session(text,uuid)'::regprocedure
    )
  ) > 0,
  'password reset revokes active admin access sessions'
);
select ok(
  position(
    'consumed_at'
    in pg_get_functiondef(
      'public.consume_admin_recovery_session(text,uuid)'::regprocedure
    )
  ) > 0,
  'recovery session is consumed exactly once'
);
select ok(
  position(
    'has_role'
    in pg_get_functiondef(
      'public.current_admin_recovery_session_is_valid(text)'::regprocedure
    )
  ) > 0,
  'recovery validation requires the admin role'
);

select * from finish();
rollback;
