begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(26);

select ok(
  not has_schema_privilege('anon', 'public', 'CREATE'),
  'anon cannot create in public'
);
select ok(
  not has_schema_privilege('authenticated', 'public', 'CREATE'),
  'authenticated cannot create in public'
);
select ok(
  not has_schema_privilege('service_role', 'public', 'CREATE'),
  'service role cannot create in public'
);
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot use private schema'
);
select ok(
  not has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated cannot use private schema'
);
select ok(
  not has_schema_privilege('service_role', 'private', 'USAGE'),
  'service role cannot use private schema directly'
);
select ok(
  not has_table_privilege('anon', 'public.services', 'SELECT'),
  'anon cannot select services directly'
);
select ok(
  has_table_privilege('authenticated', 'public.services', 'SELECT'),
  'authenticated may enter the AAL2-protected service read policy'
);
select ok(
  not has_table_privilege('service_role', 'public.appointments', 'SELECT'),
  'service role cannot select appointment token hashes directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.appointments', 'SELECT'),
  'authenticated cannot select appointment token hashes directly'
);
select ok(
  has_table_privilege('authenticated', 'public.profiles', 'SELECT'),
  'authenticated may read its RLS-protected profile'
);
select ok(
  has_function_privilege('anon', 'public.get_public_services()', 'EXECUTE'),
  'anon may execute the public service projection'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.get_public_services()',
    'EXECUTE'
  ),
  'authenticated may execute the public service projection'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.get_public_services()',
    'EXECUTE'
  ),
  'service role may execute the reviewed public projection'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_upsert_provider(uuid,text,boolean,bigint,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute admin mutations'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_upsert_provider(uuid,text,boolean,bigint,uuid)',
    'EXECUTE'
  ),
  'authenticated may enter the role-checked admin RPC'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.admin_upsert_provider(uuid,text,boolean,bigint,uuid)',
    'EXECUTE'
  ),
  'service role cannot bypass auth.uid based admin RPCs'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.assert_admin_aal2()',
    'EXECUTE'
  ),
  'anon cannot execute the private admin assertion'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.assert_admin_aal2()',
    'EXECUTE'
  ),
  'authenticated cannot invoke private helpers directly'
);
select ok(
  not has_function_privilege(
    'service_role',
    'private.assert_admin_aal2()',
    'EXECUTE'
  ),
  'service role cannot invoke private helpers directly'
);
select ok(
  not has_table_privilege('anon', 'public.appointments', 'INSERT'),
  'anon cannot insert appointments directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.services', 'UPDATE'),
  'authenticated cannot update services directly'
);
select ok(
  not has_table_privilege('service_role', 'public.contact_messages', 'INSERT'),
  'service role must use reviewed public-write RPCs'
);
select ok(
  not has_type_privilege('anon', 'public.price_type', 'USAGE'),
  'anon does not receive enum usage by default'
);
select ok(
  has_type_privilege('authenticated', 'public.price_type', 'USAGE'),
  'authenticated may use enum types required by admin RPCs'
);
select ok(
  not has_type_privilege('service_role', 'public.price_type', 'USAGE'),
  'service role receives no unnecessary enum usage'
);

select * from finish();
rollback;
