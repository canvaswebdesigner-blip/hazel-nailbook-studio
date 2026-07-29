set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.admin_get_dashboard(
  p_local_date date
)
returns table (
  confirmed_today bigint,
  completed_today bigint,
  cancelled_today bigint,
  no_show_today bigint,
  unread_contact_messages bigint,
  unread_notifications bigint,
  next_appointment_id uuid,
  next_booking_code text,
  next_customer_name text,
  next_customer_phone text,
  next_service_name text,
  next_start_at timestamptz,
  next_end_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  perform private.assert_admin_aal2();

  if p_local_date is null
    or p_local_date < date '2000-01-01'
    or p_local_date > date '2200-12-31'
  then
    raise exception 'local date is invalid'
      using errcode = '22023';
  end if;

  v_day_start := p_local_date::timestamp at time zone 'Europe/Istanbul';
  v_day_end := (p_local_date + 1)::timestamp at time zone 'Europe/Istanbul';

  return query
  with appointment_counts as (
    select
      count(*) filter (
        where appointment.status = 'confirmed'
      ) as confirmed_today,
      count(*) filter (
        where appointment.status = 'completed'
      ) as completed_today,
      count(*) filter (
        where appointment.status = 'cancelled'
      ) as cancelled_today,
      count(*) filter (
        where appointment.status = 'no_show'
      ) as no_show_today
    from public.appointments as appointment
    where appointment.start_at >= v_day_start
      and appointment.start_at < v_day_end
  ),
  message_counts as (
    select count(*) as unread_contact_messages
    from public.contact_messages as message
    where message.status = 'new'
  ),
  notification_counts as (
    select count(*) as unread_notifications
    from private.admin_notifications as notification
    where notification.read_at is null
  ),
  next_appointment as (
    select
      appointment.id,
      appointment.booking_code,
      customer.full_name,
      customer.phone_e164,
      appointment.service_name_snapshot,
      appointment.start_at,
      appointment.end_at
    from public.appointments as appointment
    join public.customers as customer
      on customer.id = appointment.customer_id
    where appointment.status = 'confirmed'
      and appointment.end_at > statement_timestamp()
    order by appointment.start_at
    limit 1
  )
  select
    appointment_counts.confirmed_today,
    appointment_counts.completed_today,
    appointment_counts.cancelled_today,
    appointment_counts.no_show_today,
    message_counts.unread_contact_messages,
    notification_counts.unread_notifications,
    next_appointment.id,
    next_appointment.booking_code,
    next_appointment.full_name,
    next_appointment.phone_e164,
    next_appointment.service_name_snapshot,
    next_appointment.start_at,
    next_appointment.end_at
  from appointment_counts
  cross join message_counts
  cross join notification_counts
  left join next_appointment on true;
end;
$$;

create or replace function public.admin_list_appointments(
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_status public.appointment_status,
  p_search text,
  p_limit integer,
  p_offset integer
)
returns table (
  appointment_id uuid,
  booking_code text,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  service_id uuid,
  service_name text,
  quoted_price numeric,
  price_type text,
  currency text,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  source text,
  customer_note text,
  admin_note text,
  row_version bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(pg_catalog.btrim(coalesce(p_search, '')), '');
begin
  perform private.assert_admin_aal2();

  if p_range_start is null
    or p_range_end is null
    or p_range_start >= p_range_end
    or p_range_end > p_range_start + interval '366 days'
    or p_limit is null
    or p_limit < 1
    or p_limit > 200
    or p_offset is null
    or p_offset < 0
    or (v_search is not null and char_length(v_search) > 100)
  then
    raise exception 'appointment list parameters are invalid'
      using errcode = '22023';
  end if;

  return query
  select
    appointment.id,
    appointment.booking_code,
    customer.id,
    customer.full_name,
    customer.phone_e164,
    customer.email,
    appointment.service_id,
    appointment.service_name_snapshot,
    appointment.quoted_price,
    appointment.price_type_snapshot::text,
    appointment.currency,
    appointment.start_at,
    appointment.end_at,
    appointment.status::text,
    appointment.source::text,
    appointment.customer_note,
    appointment.admin_note,
    appointment.row_version,
    count(*) over () as total_count
  from public.appointments as appointment
  join public.customers as customer
    on customer.id = appointment.customer_id
  where appointment.start_at >= p_range_start
    and appointment.start_at < p_range_end
    and (p_status is null or appointment.status = p_status)
    and (
      v_search is null
      or customer.full_name ilike '%' || v_search || '%'
      or customer.phone_e164 like '%' || v_search || '%'
      or appointment.booking_code ilike '%' || v_search || '%'
    )
  order by appointment.start_at desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.admin_get_dashboard(date)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_appointments(
  timestamptz,
  timestamptz,
  public.appointment_status,
  text,
  integer,
  integer
) from public, anon, authenticated, service_role;

grant execute on function public.admin_get_dashboard(date)
  to authenticated;
grant execute on function public.admin_list_appointments(
  timestamptz,
  timestamptz,
  public.appointment_status,
  text,
  integer,
  integer
) to authenticated;
