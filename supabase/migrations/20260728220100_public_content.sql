set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (user_id, role)
);

create table public.providers (
  id uuid primary key default extensions.gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 2 and 100),
  is_active boolean not null default true,
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create unique index providers_single_active_idx
  on public.providers ((is_active))
  where is_active;

create table public.services (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text not null check (char_length(short_description) between 10 and 240),
  description text not null check (char_length(description) between 10 and 5000),
  category text not null check (char_length(category) between 2 and 80),
  price numeric(12, 2),
  price_type public.price_type not null,
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  duration_minutes integer not null check (duration_minutes between 15 and 720),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 240),
  cover_image_path text,
  is_active boolean not null default true,
  is_bookable boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint services_price_matches_type check (
    (price_type = 'quote_required' and price is null)
    or (price_type in ('fixed', 'starting_from') and price is not null and price >= 0)
  )
);

create index services_public_order_idx
  on public.services (display_order, name)
  where is_active;

create table public.gallery_items (
  id uuid primary key default extensions.gen_random_uuid(),
  image_path text not null check (char_length(image_path) between 1 and 500),
  alt_text text not null check (char_length(alt_text) between 2 and 240),
  category text not null check (char_length(category) between 2 and 80),
  caption text check (caption is null or char_length(caption) <= 500),
  service_id uuid references public.services (id) on delete set null,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index gallery_items_public_order_idx
  on public.gallery_items (is_featured desc, display_order, created_at desc)
  where is_published;

create table public.testimonials (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  content text not null check (char_length(content) between 10 and 1200),
  service_label text check (service_label is null or char_length(service_label) <= 120),
  is_published boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index testimonials_public_order_idx
  on public.testimonials (display_order, created_at desc)
  where is_published;

create table public.faq_items (
  id uuid primary key default extensions.gen_random_uuid(),
  question text not null check (char_length(question) between 5 and 300),
  answer text not null check (char_length(answer) between 10 and 3000),
  category text not null check (char_length(category) between 2 and 80),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index faq_items_public_order_idx
  on public.faq_items (category, display_order)
  where is_active;

create table public.site_settings (
  singleton boolean primary key default true check (singleton),
  business_name text not null check (char_length(business_name) between 2 and 120),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_e164 text check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  instagram_url text check (instagram_url is null or char_length(instagram_url) <= 500),
  address text check (address is null or char_length(address) <= 1000),
  map_url text check (map_url is null or char_length(map_url) <= 1000),
  timezone text not null default 'Europe/Istanbul' check (timezone = 'Europe/Istanbul'),
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  minimum_notice_minutes integer not null check (minimum_notice_minutes between 0 and 10080),
  maximum_booking_days integer not null check (maximum_booking_days between 1 and 365),
  cancellation_deadline_minutes integer not null check (
    cancellation_deadline_minutes between 0 and 43200
  ),
  reschedule_deadline_minutes integer not null check (
    reschedule_deadline_minutes between 0 and 43200
  ),
  slot_granularity_minutes integer not null check (
    slot_granularity_minutes in (5, 10, 15, 20, 30, 60)
  ),
  receipt_token_lifetime_minutes integer not null check (
    receipt_token_lifetime_minutes between 15 and 525600
  ),
  management_token_lifetime_minutes integer not null check (
    management_token_lifetime_minutes between 15 and 525600
  ),
  booking_disabled boolean not null default true,
  row_version bigint not null default 0 check (row_version >= 0),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.policy_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  policy_type public.policy_type not null,
  version text not null check (version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$'),
  content text not null check (char_length(content) between 50 and 50000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  is_current boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (policy_type, version),
  unique (id, policy_type, version),
  constraint policy_documents_current_requires_publication check (
    not is_current or published_at is not null
  )
);

create unique index policy_documents_one_current_per_type_idx
  on public.policy_documents (policy_type)
  where is_current;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger providers_set_updated_at
before update on public.providers
for each row execute function private.set_updated_at_and_row_version();

create trigger services_set_updated_at
before update on public.services
for each row execute function private.set_updated_at_and_row_version();

create trigger gallery_items_set_updated_at
before update on public.gallery_items
for each row execute function private.set_updated_at_and_row_version();

create trigger testimonials_set_updated_at
before update on public.testimonials
for each row execute function private.set_updated_at_and_row_version();

create trigger faq_items_set_updated_at
before update on public.faq_items
for each row execute function private.set_updated_at_and_row_version();

create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function private.set_updated_at_and_row_version();

create trigger policy_documents_set_updated_at
before update on public.policy_documents
for each row execute function private.set_updated_at_and_row_version();
