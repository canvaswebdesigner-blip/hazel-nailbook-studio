begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(16);

select ok(
  to_regprocedure('public.admin_get_dashboard(date)') is not null,
  'named admin dashboard projection exists'
);
select ok(
  to_regprocedure(
    'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)'
  ) is not null,
  'named admin appointment-list projection exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_get_dashboard(date)',
    'EXECUTE'
  ),
  'authenticated users may enter the guarded dashboard projection'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)',
    'EXECUTE'
  ),
  'authenticated users may enter the guarded appointment projection'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_get_dashboard(date)',
    'EXECUTE'
  ),
  'anon cannot read the admin dashboard'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.admin_get_dashboard(date)',
    'EXECUTE'
  ),
  'service role cannot bypass authenticated admin dashboard authorization'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)',
    'EXECUTE'
  ),
  'anon cannot list appointments'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)',
    'EXECUTE'
  ),
  'service role cannot bypass authenticated appointment-list authorization'
);
select ok(
  position(
    'assert_admin_aal2'
    in pg_get_functiondef('public.admin_get_dashboard(date)'::regprocedure)
  ) > 0,
  'dashboard projection requires the active AAL2 admin assertion'
);
select ok(
  position(
    'assert_admin_aal2'
    in pg_get_functiondef(
      'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)'::regprocedure
    )
  ) > 0,
  'appointment projection requires the active AAL2 admin assertion'
);
select ok(
  position(
    'receipt_token_hash'
    in pg_get_function_result('public.admin_get_dashboard(date)'::regprocedure)
  ) = 0
  and position(
    'management_token_hash'
    in pg_get_function_result('public.admin_get_dashboard(date)'::regprocedure)
  ) = 0,
  'dashboard projection exposes no appointment token hash'
);
select ok(
  position(
    'receipt_token_hash'
    in pg_get_function_result(
      'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)'::regprocedure
    )
  ) = 0
  and position(
    'management_token_hash'
    in pg_get_function_result(
      'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)'::regprocedure
    )
  ) = 0,
  'appointment projection exposes no appointment token hash'
);
select ok(
  position(
    'consent_ip_hmac'
    in pg_get_function_result(
      'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)'::regprocedure
    )
  ) = 0,
  'appointment projection exposes no consent identity HMAC'
);
select ok(
  position(
    '366 days'
    in pg_get_functiondef(
      'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)'::regprocedure
    )
  ) > 0,
  'appointment list range is bounded'
);
select ok(
  position(
    'p_limit > 200'
    in pg_get_functiondef(
      'public.admin_list_appointments(timestamptz,timestamptz,public.appointment_status,text,integer,integer)'::regprocedure
    )
  ) > 0,
  'appointment list page size is bounded'
);
select ok(
  position(
    'Europe/Istanbul'
    in pg_get_functiondef('public.admin_get_dashboard(date)'::regprocedure)
  ) > 0,
  'dashboard day boundaries use the business timezone'
);

select * from finish();
rollback;
