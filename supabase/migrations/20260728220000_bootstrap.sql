set lock_timeout = '5s';
set statement_timeout = '60s';

create schema if not exists extensions;
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated, service_role;
revoke create on schema public from public, anon, authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Supabase's current default is opt-in exposure. Keep the migration safe on
-- projects created under older defaults as well.
alter default privileges in schema public revoke all on tables
  from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences
  from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges revoke execute on functions from public;
alter default privileges revoke usage on types from public;

alter default privileges in schema private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated, service_role;

create type public.app_role as enum (
  'admin'
);

create type public.price_type as enum (
  'fixed',
  'starting_from',
  'quote_required'
);

create type public.appointment_status as enum (
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

create type public.appointment_source as enum (
  'public_booking',
  'admin'
);

create type public.schedule_exception_type as enum (
  'closed',
  'special_opening',
  'shortened_day',
  'extended_day'
);

create type public.availability_block_type as enum (
  'break',
  'time_off',
  'manual_block',
  'maintenance'
);

create type public.contact_message_status as enum (
  'new',
  'in_progress',
  'resolved',
  'spam'
);

create type public.policy_type as enum (
  'privacy_notice',
  'booking_terms',
  'terms_of_use',
  'cookie_notice'
);

create type private.appointment_access_scope as enum (
  'receipt_read',
  'appointment_manage'
);

revoke usage on type
  public.app_role,
  public.price_type,
  public.appointment_status,
  public.appointment_source,
  public.schedule_exception_type,
  public.availability_block_type,
  public.contact_message_status,
  public.policy_type
from public, anon, authenticated, service_role;
revoke usage on type private.appointment_access_scope
  from public, anon, authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;

create or replace function private.set_updated_at_and_row_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.row_version := old.row_version + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.set_updated_at_and_row_version()
  from public, anon, authenticated, service_role;
