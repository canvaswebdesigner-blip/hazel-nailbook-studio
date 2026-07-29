set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or char_length(email) between 3 and 320),
  private_notes text check (private_notes is null or char_length(private_notes) <= 5000),
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.appointments (
  id uuid primary key,
  provider_id uuid not null references public.providers (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  booking_code text not null unique check (booking_code ~ '^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8,16}$'),
  token_key_version integer not null check (token_key_version > 0),
  receipt_token_hash text not null unique check (receipt_token_hash ~ '^[0-9a-f]{64}$'),
  receipt_token_expires_at timestamptz not null,
  receipt_token_revoked_at timestamptz,
  management_token_hash text not null unique check (management_token_hash ~ '^[0-9a-f]{64}$'),
  management_token_version integer not null default 1 check (management_token_version > 0),
  management_token_expires_at timestamptz not null,
  management_token_revoked_at timestamptz,
  row_version bigint not null default 0 check (row_version >= 0),
  service_name_snapshot text not null check (char_length(service_name_snapshot) between 2 and 120),
  quoted_price numeric(12, 2) check (quoted_price is null or quoted_price >= 0),
  price_type_snapshot public.price_type not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  duration_minutes_snapshot integer not null check (duration_minutes_snapshot between 15 and 720),
  buffer_before_minutes_snapshot integer not null check (
    buffer_before_minutes_snapshot between 0 and 240
  ),
  buffer_after_minutes_snapshot integer not null check (
    buffer_after_minutes_snapshot between 0 and 240
  ),
  start_at timestamptz not null,
  end_at timestamptz not null,
  occupied_start_at timestamptz not null,
  occupied_end_at timestamptz not null,
  occupied_range tstzrange generated always as (
    tstzrange(occupied_start_at, occupied_end_at, '[)')
  ) stored,
  status public.appointment_status not null default 'confirmed',
  source public.appointment_source not null,
  customer_note text check (customer_note is null or char_length(customer_note) <= 1000),
  admin_note text check (admin_note is null or char_length(admin_note) <= 5000),
  cancellation_reason text check (
    cancellation_reason is null or char_length(cancellation_reason) between 2 and 1000
  ),
  cancelled_at timestamptz,
  completed_at timestamptz,
  no_show_at timestamptz,
  privacy_notice_id uuid not null references public.policy_documents (id) on delete restrict,
  privacy_notice_type public.policy_type generated always as (
    'privacy_notice'::public.policy_type
  ) stored,
  privacy_notice_version text not null check (char_length(privacy_notice_version) between 1 and 50),
  booking_terms_id uuid not null references public.policy_documents (id) on delete restrict,
  booking_terms_type public.policy_type generated always as (
    'booking_terms'::public.policy_type
  ) stored,
  booking_terms_version text not null check (char_length(booking_terms_version) between 1 and 50),
  consented_at timestamptz not null,
  consent_source text not null check (consent_source in ('web', 'admin')),
  consent_ip_hmac text check (consent_ip_hmac is null or consent_ip_hmac ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint appointments_price_matches_type check (
    (price_type_snapshot = 'quote_required' and quoted_price is null)
    or (
      price_type_snapshot in ('fixed', 'starting_from')
      and quoted_price is not null
      and quoted_price >= 0
    )
  ),
  constraint appointments_time_order check (
    start_at < end_at
    and occupied_start_at <= start_at
    and end_at <= occupied_end_at
  ),
  constraint appointments_duration_snapshot_matches check (
    end_at = start_at + duration_minutes_snapshot * interval '1 minute'
    and occupied_start_at = start_at - buffer_before_minutes_snapshot * interval '1 minute'
    and occupied_end_at = end_at + buffer_after_minutes_snapshot * interval '1 minute'
  ),
  constraint appointments_token_expiry check (
    receipt_token_expires_at > created_at
    and management_token_expires_at > created_at
    and (
      receipt_token_revoked_at is null
      or receipt_token_revoked_at >= created_at
    )
    and (
      management_token_revoked_at is null
      or management_token_revoked_at >= created_at
    )
  ),
  constraint appointments_privacy_notice_identity_fk
    foreign key (privacy_notice_id, privacy_notice_type, privacy_notice_version)
    references public.policy_documents (id, policy_type, version)
    on delete restrict,
  constraint appointments_booking_terms_identity_fk
    foreign key (booking_terms_id, booking_terms_type, booking_terms_version)
    references public.policy_documents (id, policy_type, version)
    on delete restrict,
  constraint appointments_terminal_state_shape check (
    (
      status = 'confirmed'
      and cancelled_at is null
      and cancellation_reason is null
      and completed_at is null
      and no_show_at is null
    )
    or (
      status = 'completed'
      and completed_at is not null
      and cancelled_at is null
      and cancellation_reason is null
      and no_show_at is null
    )
    or (
      status = 'cancelled'
      and cancelled_at is not null
      and cancellation_reason is not null
      and completed_at is null
      and no_show_at is null
    )
    or (
      status = 'no_show'
      and no_show_at is not null
      and cancelled_at is null
      and cancellation_reason is null
      and completed_at is null
    )
  )
);

alter table public.appointments
  add constraint appointments_no_confirmed_overlap
  exclude using gist (
    provider_id with =,
    occupied_range with &&
  )
  where (status = 'confirmed');

create index appointments_provider_start_idx
  on public.appointments (provider_id, start_at);

create index appointments_customer_start_idx
  on public.appointments (customer_id, start_at desc);

create index appointments_status_start_idx
  on public.appointments (status, start_at);

create index appointments_receipt_expiry_idx
  on public.appointments (receipt_token_expires_at)
  where receipt_token_revoked_at is null;

create index appointments_management_expiry_idx
  on public.appointments (management_token_expires_at)
  where management_token_revoked_at is null;

create table public.contact_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or char_length(email) between 3 and 320),
  message text not null check (char_length(message) between 10 and 3000),
  privacy_notice_id uuid not null references public.policy_documents (id) on delete restrict,
  privacy_notice_type public.policy_type generated always as (
    'privacy_notice'::public.policy_type
  ) stored,
  privacy_notice_version text not null check (char_length(privacy_notice_version) between 1 and 50),
  consented_at timestamptz not null,
  status public.contact_message_status not null default 'new',
  handled_by uuid references auth.users (id) on delete restrict,
  handled_at timestamptz,
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint contact_messages_has_contact check (phone_e164 is not null or email is not null),
  constraint contact_messages_privacy_notice_identity_fk
    foreign key (privacy_notice_id, privacy_notice_type, privacy_notice_version)
    references public.policy_documents (id, policy_type, version)
    on delete restrict,
  constraint contact_messages_handling_shape check (
    (status = 'new' and handled_by is null and handled_at is null)
    or (status <> 'new' and handled_by is not null and handled_at is not null)
  )
);

create index contact_messages_status_created_idx
  on public.contact_messages (status, created_at desc);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function private.set_updated_at_and_row_version();

create trigger contact_messages_set_updated_at
before update on public.contact_messages
for each row execute function private.set_updated_at_and_row_version();

create or replace function private.enforce_appointment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_terminal_override boolean :=
    coalesce(current_setting('app.allow_terminal_override', true), 'off') = 'on';
  v_service_change_allowed boolean :=
    coalesce(current_setting('app.allow_service_change', true), 'off') = 'on';
begin
  if old.status in ('completed', 'cancelled', 'no_show')
    and new.status is distinct from old.status
    and not v_terminal_override
  then
    raise exception 'terminal appointment status cannot be changed'
      using errcode = '23514';
  end if;

  if (
    new.service_id is distinct from old.service_id
    or new.service_name_snapshot is distinct from old.service_name_snapshot
    or new.quoted_price is distinct from old.quoted_price
    or new.price_type_snapshot is distinct from old.price_type_snapshot
    or new.currency is distinct from old.currency
    or new.duration_minutes_snapshot is distinct from old.duration_minutes_snapshot
    or new.buffer_before_minutes_snapshot is distinct from old.buffer_before_minutes_snapshot
    or new.buffer_after_minutes_snapshot is distinct from old.buffer_after_minutes_snapshot
  )
  and not v_service_change_allowed
  then
    raise exception 'appointment service snapshots cannot be changed'
      using errcode = '23514';
  end if;

  if new.receipt_token_revoked_at is distinct from old.receipt_token_revoked_at
    and old.receipt_token_revoked_at is not null
  then
    raise exception 'receipt-token revocation cannot be reversed or replaced'
      using errcode = '23514';
  end if;

  if new.management_token_hash is not distinct from old.management_token_hash then
    if new.management_token_version is distinct from old.management_token_version
      or (
        old.management_token_revoked_at is not null
        and new.management_token_revoked_at is distinct from old.management_token_revoked_at
      )
    then
      raise exception 'management-token state is invalid'
        using errcode = '23514';
    end if;
  elsif new.management_token_version <> old.management_token_version + 1
    or new.management_token_revoked_at is not null
  then
    raise exception 'management-token regeneration is invalid'
      using errcode = '23514';
  end if;

  if new.id is distinct from old.id
    or new.provider_id is distinct from old.provider_id
    or new.customer_id is distinct from old.customer_id
    or new.booking_code is distinct from old.booking_code
    or new.token_key_version is distinct from old.token_key_version
    or new.receipt_token_hash is distinct from old.receipt_token_hash
    or new.privacy_notice_id is distinct from old.privacy_notice_id
    or new.privacy_notice_version is distinct from old.privacy_notice_version
    or new.booking_terms_id is distinct from old.booking_terms_id
    or new.booking_terms_version is distinct from old.booking_terms_version
    or new.consented_at is distinct from old.consented_at
    or new.consent_source is distinct from old.consent_source
    or new.consent_ip_hmac is distinct from old.consent_ip_hmac
    or new.created_at is distinct from old.created_at
  then
    raise exception 'immutable appointment fields cannot be changed'
      using errcode = '23514';
  end if;

  new.row_version := old.row_version + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.enforce_appointment_update()
  from public, anon, authenticated, service_role;

create trigger appointments_enforce_update
before update on public.appointments
for each row execute function private.enforce_appointment_update();
