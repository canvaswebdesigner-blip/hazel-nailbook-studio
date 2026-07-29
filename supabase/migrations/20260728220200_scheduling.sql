set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.business_hours (
  provider_id uuid not null references public.providers (id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time,
  end_time time,
  is_open boolean not null default false,
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (provider_id, weekday),
  constraint business_hours_open_range check (
    (is_open and start_time is not null and end_time is not null and start_time < end_time)
    or (not is_open and start_time is null and end_time is null)
  )
);

create table public.schedule_exceptions (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete restrict,
  local_date date not null,
  exception_type public.schedule_exception_type not null,
  start_time time,
  end_time time,
  reason text check (reason is null or char_length(reason) <= 500),
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (provider_id, local_date),
  constraint schedule_exceptions_time_shape check (
    (
      exception_type = 'closed'
      and start_time is null
      and end_time is null
    )
    or (
      exception_type <> 'closed'
      and start_time is not null
      and end_time is not null
      and start_time < end_time
    )
  )
);

create table public.availability_blocks (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  block_type public.availability_block_type not null,
  reason text check (reason is null or char_length(reason) <= 500),
  blocked_range tstzrange generated always as (
    tstzrange(start_at, end_at, '[)')
  ) stored,
  row_version bigint not null default 0 check (row_version >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (start_at < end_at),
  check (end_at <= start_at + interval '366 days')
);

create index availability_blocks_provider_range_idx
  on public.availability_blocks using gist (provider_id, blocked_range);

create index availability_blocks_end_at_idx
  on public.availability_blocks (end_at);

create trigger business_hours_set_updated_at
before update on public.business_hours
for each row execute function private.set_updated_at_and_row_version();

create trigger schedule_exceptions_set_updated_at
before update on public.schedule_exceptions
for each row execute function private.set_updated_at_and_row_version();

create trigger availability_blocks_set_updated_at
before update on public.availability_blocks
for each row execute function private.set_updated_at_and_row_version();

create or replace function private.provider_schedule_lock_key(p_provider_id uuid)
returns bigint
language sql
immutable
strict
set search_path = ''
as $$
  select hashtextextended('hazel-nailbook:schedule:' || p_provider_id::text, 0);
$$;

create or replace function private.provider_date_lock_key(
  p_provider_id uuid,
  p_local_date date
)
returns bigint
language sql
immutable
strict
set search_path = ''
as $$
  select hashtextextended(
    'hazel-nailbook:date:'
      || p_provider_id::text
      || ':'
      || (p_local_date - date '2000-01-01')::text,
    0
  );
$$;

create or replace function private.local_dates_for_range(
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns date[]
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_start_date date;
  v_end_date date;
  v_day_span integer;
  v_dates date[];
begin
  if p_start_at >= p_end_at
    or p_end_at > p_start_at + interval '366 days'
  then
    raise exception 'date-lock range is invalid or too large'
      using errcode = '22023';
  end if;

  v_start_date := (p_start_at at time zone 'Europe/Istanbul')::date;
  v_end_date := (
    (p_end_at - interval '1 microsecond')
    at time zone 'Europe/Istanbul'
  )::date;
  v_day_span := v_end_date - v_start_date;

  if v_day_span < 0 or v_day_span > 366 then
    raise exception 'local date-lock span is invalid or too large'
      using errcode = '22023';
  end if;

  select array_agg(v_start_date + day_offset order by day_offset)
    into v_dates
  from generate_series(0, v_day_span) as requested_days(day_offset);

  return v_dates;
end;
$$;

create or replace function private.lock_provider_schedule_shared(p_provider_id uuid)
returns void
language sql
volatile
strict
set search_path = ''
as $$
  select pg_advisory_xact_lock_shared(private.provider_schedule_lock_key(p_provider_id));
$$;

create or replace function private.lock_provider_schedule_exclusive(p_provider_id uuid)
returns void
language sql
volatile
strict
set search_path = ''
as $$
  select pg_advisory_xact_lock(private.provider_schedule_lock_key(p_provider_id));
$$;

create or replace function private.lock_provider_dates(
  p_provider_id uuid,
  p_local_dates date[]
)
returns void
language plpgsql
volatile
strict
set search_path = ''
as $$
declare
  v_local_date date;
begin
  for v_local_date in
    select distinct local_date
    from unnest(p_local_dates) as requested_dates(local_date)
    where local_date is not null
    order by local_date
  loop
    perform pg_advisory_xact_lock(
      private.provider_date_lock_key(p_provider_id, v_local_date)
    );
  end loop;
end;
$$;

revoke all on function private.provider_schedule_lock_key(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.provider_date_lock_key(uuid, date)
  from public, anon, authenticated, service_role;
revoke all on function private.local_dates_for_range(timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function private.lock_provider_schedule_shared(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.lock_provider_schedule_exclusive(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.lock_provider_dates(uuid, date[])
  from public, anon, authenticated, service_role;
