begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(25);

select ok(to_regnamespace('private') is not null, 'private schema exists');
select ok(to_regclass('public.providers') is not null, 'providers table exists');
select ok(to_regclass('public.services') is not null, 'services table exists');
select ok(
  to_regclass('public.policy_documents') is not null,
  'policy documents table exists'
);
select ok(
  to_regclass('public.business_hours') is not null,
  'business hours table exists'
);
select ok(
  to_regclass('public.schedule_exceptions') is not null,
  'schedule exceptions table exists'
);
select ok(
  to_regclass('public.availability_blocks') is not null,
  'availability blocks table exists'
);
select ok(to_regclass('public.customers') is not null, 'customers table exists');
select ok(
  to_regclass('public.appointments') is not null,
  'appointments table exists'
);
select ok(
  to_regclass('public.contact_messages') is not null,
  'contact messages table exists'
);
select ok(
  to_regclass('private.idempotency_keys') is not null,
  'private idempotency table exists'
);
select ok(
  to_regclass('private.rate_limit_counters') is not null,
  'private rate-limit table exists'
);
select ok(
  to_regclass('private.appointment_access_sessions') is not null,
  'private appointment sessions table exists'
);
select ok(
  to_regclass('private.audit_logs') is not null,
  'private audit table exists'
);
select ok(
  to_regclass('private.admin_notifications') is not null,
  'private notifications table exists'
);
select is(
  (
    select count(*)::integer
    from pg_class as relation
    join pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'r'
      and not relation.relrowsecurity
      and relation.relname in (
        'profiles',
        'user_roles',
        'providers',
        'services',
        'gallery_items',
        'testimonials',
        'faq_items',
        'site_settings',
        'policy_documents',
        'business_hours',
        'schedule_exceptions',
        'availability_blocks',
        'customers',
        'appointments',
        'contact_messages'
      )
  ),
  0,
  'RLS is enabled on every public application table'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_no_confirmed_overlap'
      and contype = 'x'
  ),
  'confirmed appointment overlap has an exclusion constraint'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_privacy_notice_identity_fk'
      and contype = 'f'
  ),
  'appointment privacy evidence has a composite foreign key'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_booking_terms_identity_fk'
      and contype = 'f'
  ),
  'appointment booking-terms evidence has a composite foreign key'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.contact_messages'::regclass
      and conname = 'contact_messages_privacy_notice_identity_fk'
      and contype = 'f'
  ),
  'contact privacy evidence has a composite foreign key'
);
select ok(
  to_regprocedure('public.get_public_services()') is not null,
  'public services projection exists'
);
select ok(
  to_regprocedure(
    'public.admin_upsert_provider(uuid,text,boolean,bigint,uuid)'
  ) is not null,
  'named admin provider mutation exists'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'providers'
      and indexname = 'providers_single_active_idx'
  ),
  'only one active provider is allowed'
);
select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'gallery-staging'
      and not public
  )
  and exists (
    select 1
    from storage.buckets
    where id = 'gallery-public'
      and public
  ),
  'private staging and public gallery buckets exist'
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
  'safe admin table reads require an active AAL2 admin session'
);

select * from finish();
rollback;
