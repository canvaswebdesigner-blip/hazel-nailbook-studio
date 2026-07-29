set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.gallery_items enable row level security;
alter table public.testimonials enable row level security;
alter table public.faq_items enable row level security;
alter table public.site_settings enable row level security;
alter table public.policy_documents enable row level security;
alter table public.business_hours enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.contact_messages enable row level security;

revoke all on table
  public.profiles,
  public.user_roles,
  public.providers,
  public.services,
  public.gallery_items,
  public.testimonials,
  public.faq_items,
  public.site_settings,
  public.policy_documents,
  public.business_hours,
  public.schedule_exceptions,
  public.availability_blocks,
  public.customers,
  public.appointments,
  public.contact_messages
  from anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
grant usage on type
  public.app_role,
  public.price_type,
  public.schedule_exception_type,
  public.availability_block_type,
  public.contact_message_status,
  public.policy_type
to authenticated;

create or replace function public.has_role(
  p_user_id uuid,
  p_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id = auth.uid()
    and exists (
      select 1
      from public.user_roles as roles
      where roles.user_id = p_user_id
        and roles.role = p_role
    );
$$;

revoke all on function public.has_role(uuid, public.app_role)
  from public, anon, authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role)
  to authenticated;

create or replace function public.current_session_is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

revoke all on function public.current_session_is_aal2()
  from public, anon, authenticated, service_role;
grant execute on function public.current_session_is_aal2()
  to authenticated;

create or replace function private.assert_admin_aal2()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'admin'::public.app_role)
    or not public.current_session_is_aal2()
  then
    raise exception 'insufficient privileges'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_admin_aal2()
  from public, anon, authenticated, service_role;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

grant select on public.profiles, public.user_roles to authenticated;

create policy providers_admin_select
on public.providers
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy services_admin_select
on public.services
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy gallery_items_admin_select
on public.gallery_items
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy testimonials_admin_select
on public.testimonials
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy faq_items_admin_select
on public.faq_items
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy site_settings_admin_select
on public.site_settings
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy policy_documents_admin_select
on public.policy_documents
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy business_hours_admin_select
on public.business_hours
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy schedule_exceptions_admin_select
on public.schedule_exceptions
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy availability_blocks_admin_select
on public.availability_blocks
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

create policy contact_messages_admin_select
on public.contact_messages
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  and public.current_session_is_aal2()
);

grant select on table
  public.providers,
  public.services,
  public.gallery_items,
  public.testimonials,
  public.faq_items,
  public.site_settings,
  public.policy_documents,
  public.business_hours,
  public.schedule_exceptions,
  public.availability_blocks,
  public.contact_messages
to authenticated;

create or replace function public.get_public_site_settings()
returns table (
  business_name text,
  phone_e164 text,
  whatsapp_e164 text,
  instagram_url text,
  address text,
  map_url text,
  timezone text,
  currency text,
  minimum_notice_minutes integer,
  maximum_booking_days integer,
  cancellation_deadline_minutes integer,
  reschedule_deadline_minutes integer,
  slot_granularity_minutes integer,
  booking_disabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    settings.business_name,
    settings.phone_e164,
    settings.whatsapp_e164,
    settings.instagram_url,
    settings.address,
    settings.map_url,
    settings.timezone,
    settings.currency,
    settings.minimum_notice_minutes,
    settings.maximum_booking_days,
    settings.cancellation_deadline_minutes,
    settings.reschedule_deadline_minutes,
    settings.slot_granularity_minutes,
    settings.booking_disabled
  from public.site_settings as settings
  where settings.singleton;
$$;

create or replace function public.get_public_business_hours()
returns table (
  weekday smallint,
  start_time time,
  end_time time,
  is_open boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    hours.weekday,
    hours.start_time,
    hours.end_time,
    hours.is_open
  from public.business_hours as hours
  join public.providers as provider
    on provider.id = hours.provider_id
  where provider.is_active
  order by hours.weekday;
$$;

create or replace function public.get_public_services()
returns table (
  id uuid,
  name text,
  slug text,
  short_description text,
  description text,
  category text,
  price numeric,
  price_type text,
  currency text,
  duration_minutes integer,
  cover_image_path text,
  is_bookable boolean,
  display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    service.id,
    service.name,
    service.slug,
    service.short_description,
    service.description,
    service.category,
    service.price,
    service.price_type::text,
    service.currency,
    service.duration_minutes,
    service.cover_image_path,
    service.is_bookable,
    service.display_order
  from public.services as service
  where service.is_active
  order by service.display_order, service.name;
$$;

create or replace function public.get_public_service_by_slug(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  short_description text,
  description text,
  category text,
  price numeric,
  price_type text,
  currency text,
  duration_minutes integer,
  cover_image_path text,
  is_bookable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    service.id,
    service.name,
    service.slug,
    service.short_description,
    service.description,
    service.category,
    service.price,
    service.price_type::text,
    service.currency,
    service.duration_minutes,
    service.cover_image_path,
    service.is_bookable
  from public.services as service
  where service.is_active
    and service.slug = p_slug;
$$;

create or replace function public.get_public_gallery()
returns table (
  id uuid,
  image_path text,
  alt_text text,
  category text,
  caption text,
  service_slug text,
  service_name text,
  is_featured boolean,
  display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    item.id,
    item.image_path,
    item.alt_text,
    item.category,
    item.caption,
    service.slug,
    service.name,
    item.is_featured,
    item.display_order
  from public.gallery_items as item
  left join public.services as service
    on service.id = item.service_id
    and service.is_active
  where item.is_published
  order by item.is_featured desc, item.display_order, item.created_at desc;
$$;

create or replace function public.get_public_testimonials()
returns table (
  id uuid,
  customer_name text,
  content text,
  service_label text,
  display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    testimonial.id,
    testimonial.customer_name,
    testimonial.content,
    testimonial.service_label,
    testimonial.display_order
  from public.testimonials as testimonial
  where testimonial.is_published
  order by testimonial.display_order, testimonial.created_at desc;
$$;

create or replace function public.get_public_faq()
returns table (
  id uuid,
  question text,
  answer text,
  category text,
  display_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    faq.id,
    faq.question,
    faq.answer,
    faq.category,
    faq.display_order
  from public.faq_items as faq
  where faq.is_active
  order by faq.category, faq.display_order;
$$;

create or replace function public.get_current_policy_documents()
returns table (
  policy_type text,
  version text,
  content text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    policy.policy_type::text,
    policy.version,
    policy.content,
    policy.published_at
  from public.policy_documents as policy
  where policy.is_current
    and policy.published_at is not null
  order by policy.policy_type;
$$;

create or replace function public.health_check()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select true;
$$;

revoke all on function public.get_public_site_settings()
  from public, anon, authenticated, service_role;
revoke all on function public.get_public_business_hours()
  from public, anon, authenticated, service_role;
revoke all on function public.get_public_services()
  from public, anon, authenticated, service_role;
revoke all on function public.get_public_service_by_slug(text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_public_gallery()
  from public, anon, authenticated, service_role;
revoke all on function public.get_public_testimonials()
  from public, anon, authenticated, service_role;
revoke all on function public.get_public_faq()
  from public, anon, authenticated, service_role;
revoke all on function public.get_current_policy_documents()
  from public, anon, authenticated, service_role;
revoke all on function public.health_check()
  from public, anon, authenticated, service_role;

grant execute on function public.get_public_site_settings()
  to anon, authenticated, service_role;
grant execute on function public.get_public_business_hours()
  to anon, authenticated, service_role;
grant execute on function public.get_public_services()
  to anon, authenticated, service_role;
grant execute on function public.get_public_service_by_slug(text)
  to anon, authenticated, service_role;
grant execute on function public.get_public_gallery()
  to anon, authenticated, service_role;
grant execute on function public.get_public_testimonials()
  to anon, authenticated, service_role;
grant execute on function public.get_public_faq()
  to anon, authenticated, service_role;
grant execute on function public.get_current_policy_documents()
  to anon, authenticated, service_role;
grant execute on function public.health_check()
  to anon, authenticated, service_role;
