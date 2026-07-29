set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function private.write_admin_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb,
  p_request_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authenticated actor is required'
      using errcode = '42501';
  end if;

  insert into private.audit_logs (
    actor_user_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    metadata,
    request_id
  )
  values (
    auth.uid(),
    'admin',
    p_action,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb),
    p_request_id
  );
end;
$$;

revoke all on function private.write_admin_audit(text, text, text, jsonb, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.admin_upsert_provider(
  p_id uuid,
  p_display_name text,
  p_is_active boolean,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns table (result_id uuid, result_row_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row_version bigint;
  v_action text;
begin
  perform private.assert_admin_aal2();

  if p_id is not null then
    perform private.lock_provider_schedule_exclusive(p_id);
  end if;

  if p_id is null then
    if p_expected_row_version is not null then
      raise exception 'row version must be null when creating a provider'
        using errcode = '22023';
    end if;

    insert into public.providers (display_name, is_active)
    values (p_display_name, p_is_active)
    returning id, row_version into v_id, v_row_version;
    v_action := 'provider.created';
  else
    if p_expected_row_version is null then
      raise exception 'row version is required when updating a provider'
        using errcode = '22023';
    end if;

    update public.providers as provider
    set
      display_name = p_display_name,
      is_active = p_is_active
    where provider.id = p_id
      and provider.row_version = p_expected_row_version
    returning provider.id, provider.row_version into v_id, v_row_version;

    if not found then
      raise exception 'stale provider row'
        using errcode = '40001';
    end if;

    v_action := 'provider.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'provider',
    v_id::text,
    jsonb_build_object('row_version', v_row_version),
    p_request_id
  );

  return query select v_id, v_row_version;
end;
$$;

create or replace function public.admin_upsert_service(
  p_id uuid,
  p_name text,
  p_slug text,
  p_short_description text,
  p_description text,
  p_category text,
  p_price numeric,
  p_price_type public.price_type,
  p_currency text,
  p_duration_minutes integer,
  p_buffer_before_minutes integer,
  p_buffer_after_minutes integer,
  p_cover_image_path text,
  p_is_active boolean,
  p_is_bookable boolean,
  p_display_order integer,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns table (result_id uuid, result_row_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row_version bigint;
  v_action text;
begin
  perform private.assert_admin_aal2();

  if p_id is null then
    if p_expected_row_version is not null then
      raise exception 'row version must be null when creating a service'
        using errcode = '22023';
    end if;

    insert into public.services (
      name,
      slug,
      short_description,
      description,
      category,
      price,
      price_type,
      currency,
      duration_minutes,
      buffer_before_minutes,
      buffer_after_minutes,
      cover_image_path,
      is_active,
      is_bookable,
      display_order
    )
    values (
      p_name,
      p_slug,
      p_short_description,
      p_description,
      p_category,
      p_price,
      p_price_type,
      p_currency,
      p_duration_minutes,
      p_buffer_before_minutes,
      p_buffer_after_minutes,
      p_cover_image_path,
      p_is_active,
      p_is_bookable,
      p_display_order
    )
    returning id, row_version into v_id, v_row_version;
    v_action := 'service.created';
  else
    if p_expected_row_version is null then
      raise exception 'row version is required when updating a service'
        using errcode = '22023';
    end if;

    update public.services as service
    set
      name = p_name,
      slug = p_slug,
      short_description = p_short_description,
      description = p_description,
      category = p_category,
      price = p_price,
      price_type = p_price_type,
      currency = p_currency,
      duration_minutes = p_duration_minutes,
      buffer_before_minutes = p_buffer_before_minutes,
      buffer_after_minutes = p_buffer_after_minutes,
      cover_image_path = p_cover_image_path,
      is_active = p_is_active,
      is_bookable = p_is_bookable,
      display_order = p_display_order
    where service.id = p_id
      and service.row_version = p_expected_row_version
    returning service.id, service.row_version into v_id, v_row_version;

    if not found then
      raise exception 'stale service row'
        using errcode = '40001';
    end if;

    v_action := 'service.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'service',
    v_id::text,
    jsonb_build_object('row_version', v_row_version),
    p_request_id
  );

  return query select v_id, v_row_version;
end;
$$;

create or replace function public.admin_update_business_hours(
  p_provider_id uuid,
  p_weekday smallint,
  p_start_time time,
  p_end_time time,
  p_is_open boolean,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns table (
  result_provider_id uuid,
  result_weekday smallint,
  result_row_version bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row_version bigint;
  v_action text;
begin
  perform private.assert_admin_aal2();
  perform private.lock_provider_schedule_exclusive(p_provider_id);

  if p_expected_row_version is null then
    insert into public.business_hours (
      provider_id,
      weekday,
      start_time,
      end_time,
      is_open
    )
    values (
      p_provider_id,
      p_weekday,
      p_start_time,
      p_end_time,
      p_is_open
    )
    returning row_version into v_row_version;
    v_action := 'business_hours.created';
  else
    update public.business_hours as hours
    set
      start_time = p_start_time,
      end_time = p_end_time,
      is_open = p_is_open
    where hours.provider_id = p_provider_id
      and hours.weekday = p_weekday
      and hours.row_version = p_expected_row_version
    returning hours.row_version into v_row_version;

    if not found then
      raise exception 'stale business-hours row'
        using errcode = '40001';
    end if;

    v_action := 'business_hours.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'business_hours',
    p_provider_id::text || ':' || p_weekday::text,
    jsonb_build_object('row_version', v_row_version),
    p_request_id
  );

  return query select p_provider_id, p_weekday, v_row_version;
end;
$$;

create or replace function public.admin_upsert_schedule_exception(
  p_id uuid,
  p_provider_id uuid,
  p_local_date date,
  p_exception_type public.schedule_exception_type,
  p_start_time time,
  p_end_time time,
  p_reason text,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns table (result_id uuid, result_row_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row_version bigint;
  v_action text;
  v_old_local_date date;
begin
  perform private.assert_admin_aal2();

  if p_id is not null then
    select exception.local_date
      into v_old_local_date
    from public.schedule_exceptions as exception
    where exception.id = p_id
      and exception.provider_id = p_provider_id;

    if not found then
      raise exception 'schedule exception not found'
        using errcode = '40001';
    end if;
  end if;

  perform private.lock_provider_schedule_shared(p_provider_id);
  perform private.lock_provider_dates(
    p_provider_id,
    array[p_local_date, v_old_local_date]
  );

  if p_id is null then
    if p_expected_row_version is not null then
      raise exception 'row version must be null when creating a schedule exception'
        using errcode = '22023';
    end if;

    insert into public.schedule_exceptions (
      provider_id,
      local_date,
      exception_type,
      start_time,
      end_time,
      reason
    )
    values (
      p_provider_id,
      p_local_date,
      p_exception_type,
      p_start_time,
      p_end_time,
      p_reason
    )
    returning id, row_version into v_id, v_row_version;
    v_action := 'schedule_exception.created';
  else
    if p_expected_row_version is null then
      raise exception 'row version is required when updating a schedule exception'
        using errcode = '22023';
    end if;

    update public.schedule_exceptions as exception
    set
      local_date = p_local_date,
      exception_type = p_exception_type,
      start_time = p_start_time,
      end_time = p_end_time,
      reason = p_reason
    where exception.id = p_id
      and exception.provider_id = p_provider_id
      and exception.row_version = p_expected_row_version
    returning exception.id, exception.row_version into v_id, v_row_version;

    if not found then
      raise exception 'stale schedule-exception row'
        using errcode = '40001';
    end if;

    v_action := 'schedule_exception.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'schedule_exception',
    v_id::text,
    jsonb_build_object(
      'provider_id',
      p_provider_id,
      'local_date',
      p_local_date,
      'row_version',
      v_row_version
    ),
    p_request_id
  );

  return query select v_id, v_row_version;
end;
$$;

create or replace function public.admin_upsert_availability_block(
  p_id uuid,
  p_provider_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_block_type public.availability_block_type,
  p_reason text,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns table (result_id uuid, result_row_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row_version bigint;
  v_action text;
  v_old_start_at timestamptz;
  v_old_end_at timestamptz;
  v_lock_dates date[];
begin
  perform private.assert_admin_aal2();

  if p_id is not null then
    select block.start_at, block.end_at
      into v_old_start_at, v_old_end_at
    from public.availability_blocks as block
    where block.id = p_id
      and block.provider_id = p_provider_id;

    if not found then
      raise exception 'availability block not found'
        using errcode = '40001';
    end if;
  end if;

  v_lock_dates := array_cat(
    private.local_dates_for_range(p_start_at, p_end_at),
    case
      when v_old_start_at is null then array[]::date[]
      else private.local_dates_for_range(v_old_start_at, v_old_end_at)
    end
  );

  perform private.lock_provider_schedule_shared(p_provider_id);
  perform private.lock_provider_dates(p_provider_id, v_lock_dates);

  if p_id is null then
    if p_expected_row_version is not null then
      raise exception 'row version must be null when creating an availability block'
        using errcode = '22023';
    end if;

    insert into public.availability_blocks (
      provider_id,
      start_at,
      end_at,
      block_type,
      reason
    )
    values (
      p_provider_id,
      p_start_at,
      p_end_at,
      p_block_type,
      p_reason
    )
    returning id, row_version into v_id, v_row_version;
    v_action := 'availability_block.created';
  else
    if p_expected_row_version is null then
      raise exception 'row version is required when updating an availability block'
        using errcode = '22023';
    end if;

    update public.availability_blocks as block
    set
      start_at = p_start_at,
      end_at = p_end_at,
      block_type = p_block_type,
      reason = p_reason
    where block.id = p_id
      and block.provider_id = p_provider_id
      and block.row_version = p_expected_row_version
    returning block.id, block.row_version into v_id, v_row_version;

    if not found then
      raise exception 'stale availability-block row'
        using errcode = '40001';
    end if;

    v_action := 'availability_block.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'availability_block',
    v_id::text,
    jsonb_build_object(
      'provider_id',
      p_provider_id,
      'row_version',
      v_row_version
    ),
    p_request_id
  );

  return query select v_id, v_row_version;
end;
$$;

create or replace function public.admin_delete_schedule_exception(
  p_id uuid,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_provider_id uuid;
  v_local_date date;
begin
  perform private.assert_admin_aal2();

  select exception.provider_id, exception.local_date
    into v_provider_id, v_local_date
  from public.schedule_exceptions as exception
  where exception.id = p_id;

  if not found then
    raise exception 'schedule exception not found'
      using errcode = '40001';
  end if;

  perform private.lock_provider_schedule_shared(v_provider_id);
  perform private.lock_provider_dates(v_provider_id, array[v_local_date]);

  delete from public.schedule_exceptions as exception
  where exception.id = p_id
    and exception.row_version = p_expected_row_version;

  if not found then
    raise exception 'stale schedule-exception row'
      using errcode = '40001';
  end if;

  perform private.write_admin_audit(
    'schedule_exception.deleted',
    'schedule_exception',
    p_id::text,
    jsonb_build_object(
      'provider_id',
      v_provider_id,
      'local_date',
      v_local_date
    ),
    p_request_id
  );

  return true;
end;
$$;

create or replace function public.admin_delete_availability_block(
  p_id uuid,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_provider_id uuid;
  v_start_at timestamptz;
  v_end_at timestamptz;
begin
  perform private.assert_admin_aal2();

  select block.provider_id, block.start_at, block.end_at
    into v_provider_id, v_start_at, v_end_at
  from public.availability_blocks as block
  where block.id = p_id;

  if not found then
    raise exception 'availability block not found'
      using errcode = '40001';
  end if;

  perform private.lock_provider_schedule_shared(v_provider_id);
  perform private.lock_provider_dates(
    v_provider_id,
    private.local_dates_for_range(v_start_at, v_end_at)
  );

  delete from public.availability_blocks as block
  where block.id = p_id
    and block.row_version = p_expected_row_version;

  if not found then
    raise exception 'stale availability-block row'
      using errcode = '40001';
  end if;

  perform private.write_admin_audit(
    'availability_block.deleted',
    'availability_block',
    p_id::text,
    jsonb_build_object('provider_id', v_provider_id),
    p_request_id
  );

  return true;
end;
$$;

create or replace function public.admin_upsert_gallery_item(
  p_id uuid,
  p_image_path text,
  p_alt_text text,
  p_category text,
  p_caption text,
  p_service_id uuid,
  p_is_featured boolean,
  p_is_published boolean,
  p_display_order integer,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns table (result_id uuid, result_row_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row_version bigint;
  v_action text;
begin
  perform private.assert_admin_aal2();

  if p_id is null then
    if p_expected_row_version is not null then
      raise exception 'row version must be null when creating a gallery item'
        using errcode = '22023';
    end if;

    insert into public.gallery_items (
      image_path,
      alt_text,
      category,
      caption,
      service_id,
      is_featured,
      is_published,
      display_order
    )
    values (
      p_image_path,
      p_alt_text,
      p_category,
      p_caption,
      p_service_id,
      p_is_featured,
      p_is_published,
      p_display_order
    )
    returning id, row_version into v_id, v_row_version;
    v_action := 'gallery_item.created';
  else
    if p_expected_row_version is null then
      raise exception 'row version is required when updating a gallery item'
        using errcode = '22023';
    end if;

    update public.gallery_items as item
    set
      image_path = p_image_path,
      alt_text = p_alt_text,
      category = p_category,
      caption = p_caption,
      service_id = p_service_id,
      is_featured = p_is_featured,
      is_published = p_is_published,
      display_order = p_display_order
    where item.id = p_id
      and item.row_version = p_expected_row_version
    returning item.id, item.row_version into v_id, v_row_version;

    if not found then
      raise exception 'stale gallery-item row'
        using errcode = '40001';
    end if;

    v_action := 'gallery_item.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'gallery_item',
    v_id::text,
    jsonb_build_object('row_version', v_row_version),
    p_request_id
  );

  return query select v_id, v_row_version;
end;
$$;

create or replace function public.admin_upsert_testimonial(
  p_id uuid,
  p_customer_name text,
  p_content text,
  p_service_label text,
  p_is_published boolean,
  p_display_order integer,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns table (result_id uuid, result_row_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row_version bigint;
  v_action text;
begin
  perform private.assert_admin_aal2();

  if p_id is null then
    if p_expected_row_version is not null then
      raise exception 'row version must be null when creating a testimonial'
        using errcode = '22023';
    end if;

    insert into public.testimonials (
      customer_name,
      content,
      service_label,
      is_published,
      display_order
    )
    values (
      p_customer_name,
      p_content,
      p_service_label,
      p_is_published,
      p_display_order
    )
    returning id, row_version into v_id, v_row_version;
    v_action := 'testimonial.created';
  else
    if p_expected_row_version is null then
      raise exception 'row version is required when updating a testimonial'
        using errcode = '22023';
    end if;

    update public.testimonials as testimonial
    set
      customer_name = p_customer_name,
      content = p_content,
      service_label = p_service_label,
      is_published = p_is_published,
      display_order = p_display_order
    where testimonial.id = p_id
      and testimonial.row_version = p_expected_row_version
    returning testimonial.id, testimonial.row_version into v_id, v_row_version;

    if not found then
      raise exception 'stale testimonial row'
        using errcode = '40001';
    end if;

    v_action := 'testimonial.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'testimonial',
    v_id::text,
    jsonb_build_object('row_version', v_row_version),
    p_request_id
  );

  return query select v_id, v_row_version;
end;
$$;

create or replace function public.admin_upsert_faq(
  p_id uuid,
  p_question text,
  p_answer text,
  p_category text,
  p_is_active boolean,
  p_display_order integer,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns table (result_id uuid, result_row_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row_version bigint;
  v_action text;
begin
  perform private.assert_admin_aal2();

  if p_id is null then
    if p_expected_row_version is not null then
      raise exception 'row version must be null when creating an FAQ item'
        using errcode = '22023';
    end if;

    insert into public.faq_items (
      question,
      answer,
      category,
      is_active,
      display_order
    )
    values (
      p_question,
      p_answer,
      p_category,
      p_is_active,
      p_display_order
    )
    returning id, row_version into v_id, v_row_version;
    v_action := 'faq.created';
  else
    if p_expected_row_version is null then
      raise exception 'row version is required when updating an FAQ item'
        using errcode = '22023';
    end if;

    update public.faq_items as faq
    set
      question = p_question,
      answer = p_answer,
      category = p_category,
      is_active = p_is_active,
      display_order = p_display_order
    where faq.id = p_id
      and faq.row_version = p_expected_row_version
    returning faq.id, faq.row_version into v_id, v_row_version;

    if not found then
      raise exception 'stale FAQ row'
        using errcode = '40001';
    end if;

    v_action := 'faq.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'faq',
    v_id::text,
    jsonb_build_object('row_version', v_row_version),
    p_request_id
  );

  return query select v_id, v_row_version;
end;
$$;

create or replace function public.admin_update_site_settings(
  p_business_name text,
  p_phone_e164 text,
  p_whatsapp_e164 text,
  p_instagram_url text,
  p_address text,
  p_map_url text,
  p_timezone text,
  p_currency text,
  p_minimum_notice_minutes integer,
  p_maximum_booking_days integer,
  p_cancellation_deadline_minutes integer,
  p_reschedule_deadline_minutes integer,
  p_slot_granularity_minutes integer,
  p_receipt_token_lifetime_minutes integer,
  p_management_token_lifetime_minutes integer,
  p_booking_disabled boolean,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row_version bigint;
  v_action text;
  v_provider_id uuid;
begin
  perform private.assert_admin_aal2();

  select provider.id
    into v_provider_id
  from public.providers as provider
  where provider.is_active;

  if found then
    perform private.lock_provider_schedule_exclusive(v_provider_id);
  end if;

  if p_expected_row_version is null then
    insert into public.site_settings (
      singleton,
      business_name,
      phone_e164,
      whatsapp_e164,
      instagram_url,
      address,
      map_url,
      timezone,
      currency,
      minimum_notice_minutes,
      maximum_booking_days,
      cancellation_deadline_minutes,
      reschedule_deadline_minutes,
      slot_granularity_minutes,
      receipt_token_lifetime_minutes,
      management_token_lifetime_minutes,
      booking_disabled,
      updated_by
    )
    values (
      true,
      p_business_name,
      p_phone_e164,
      p_whatsapp_e164,
      p_instagram_url,
      p_address,
      p_map_url,
      p_timezone,
      p_currency,
      p_minimum_notice_minutes,
      p_maximum_booking_days,
      p_cancellation_deadline_minutes,
      p_reschedule_deadline_minutes,
      p_slot_granularity_minutes,
      p_receipt_token_lifetime_minutes,
      p_management_token_lifetime_minutes,
      p_booking_disabled,
      auth.uid()
    )
    returning row_version into v_row_version;
    v_action := 'site_settings.created';
  else
    update public.site_settings as settings
    set
      business_name = p_business_name,
      phone_e164 = p_phone_e164,
      whatsapp_e164 = p_whatsapp_e164,
      instagram_url = p_instagram_url,
      address = p_address,
      map_url = p_map_url,
      timezone = p_timezone,
      currency = p_currency,
      minimum_notice_minutes = p_minimum_notice_minutes,
      maximum_booking_days = p_maximum_booking_days,
      cancellation_deadline_minutes = p_cancellation_deadline_minutes,
      reschedule_deadline_minutes = p_reschedule_deadline_minutes,
      slot_granularity_minutes = p_slot_granularity_minutes,
      receipt_token_lifetime_minutes = p_receipt_token_lifetime_minutes,
      management_token_lifetime_minutes = p_management_token_lifetime_minutes,
      booking_disabled = p_booking_disabled,
      updated_by = auth.uid()
    where settings.singleton
      and settings.row_version = p_expected_row_version
    returning settings.row_version into v_row_version;

    if not found then
      raise exception 'stale site-settings row'
        using errcode = '40001';
    end if;

    v_action := 'site_settings.updated';
  end if;

  perform private.write_admin_audit(
    v_action,
    'site_settings',
    'singleton',
    jsonb_build_object(
      'row_version',
      v_row_version,
      'booking_disabled',
      p_booking_disabled
    ),
    p_request_id
  );

  return v_row_version;
end;
$$;

create or replace function public.admin_publish_policy_document(
  p_policy_type public.policy_type,
  p_version text,
  p_content text,
  p_request_id uuid
)
returns table (result_id uuid, result_row_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_row_version bigint;
  v_content_sha256 text;
begin
  perform private.assert_admin_aal2();

  v_content_sha256 := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_content, 'UTF8'), 'sha256'),
    'hex'
  );

  update public.policy_documents as policy
  set is_current = false
  where policy.policy_type = p_policy_type
    and policy.is_current;

  insert into public.policy_documents (
    policy_type,
    version,
    content,
    content_sha256,
    published_at,
    is_current,
    created_by
  )
  values (
    p_policy_type,
    p_version,
    p_content,
    v_content_sha256,
    statement_timestamp(),
    true,
    auth.uid()
  )
  returning id, row_version into v_id, v_row_version;

  perform private.write_admin_audit(
    'policy_document.published',
    'policy_document',
    v_id::text,
    jsonb_build_object(
      'policy_type',
      p_policy_type::text,
      'version',
      p_version,
      'content_sha256',
      v_content_sha256
    ),
    p_request_id
  );

  return query select v_id, v_row_version;
end;
$$;

create or replace function public.admin_update_contact_status(
  p_id uuid,
  p_status public.contact_message_status,
  p_expected_row_version bigint,
  p_request_id uuid
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row_version bigint;
begin
  perform private.assert_admin_aal2();

  update public.contact_messages as message
  set
    status = p_status,
    handled_by = case
      when p_status = 'new' then null
      else auth.uid()
    end,
    handled_at = case
      when p_status = 'new' then null
      else statement_timestamp()
    end
  where message.id = p_id
    and message.row_version = p_expected_row_version
  returning message.row_version into v_row_version;

  if not found then
    raise exception 'stale contact-message row'
      using errcode = '40001';
  end if;

  perform private.write_admin_audit(
    'contact_message.status_updated',
    'contact_message',
    p_id::text,
    jsonb_build_object(
      'status',
      p_status::text,
      'row_version',
      v_row_version
    ),
    p_request_id
  );

  return v_row_version;
end;
$$;

create or replace function public.admin_mark_notifications_read(
  p_notification_ids uuid[],
  p_request_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_updated_count integer;
begin
  perform private.assert_admin_aal2();

  if coalesce(array_length(p_notification_ids, 1), 0) > 100 then
    raise exception 'too many notification IDs'
      using errcode = '22023';
  end if;

  update private.admin_notifications as notification
  set read_at = statement_timestamp()
  where notification.id = any(p_notification_ids)
    and notification.read_at is null;

  get diagnostics v_updated_count = row_count;

  perform private.write_admin_audit(
    'admin_notification.marked_read',
    'admin_notification',
    null,
    jsonb_build_object('updated_count', v_updated_count),
    p_request_id
  );

  return v_updated_count;
end;
$$;

revoke all on function public.admin_upsert_provider(uuid, text, boolean, bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_upsert_service(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  public.price_type,
  text,
  integer,
  integer,
  integer,
  text,
  boolean,
  boolean,
  integer,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_update_business_hours(
  uuid,
  smallint,
  time,
  time,
  boolean,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_upsert_schedule_exception(
  uuid,
  uuid,
  date,
  public.schedule_exception_type,
  time,
  time,
  text,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_upsert_availability_block(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  public.availability_block_type,
  text,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_schedule_exception(uuid, bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_delete_availability_block(uuid, bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_upsert_gallery_item(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  boolean,
  boolean,
  integer,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_upsert_testimonial(
  uuid,
  text,
  text,
  text,
  boolean,
  integer,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_upsert_faq(
  uuid,
  text,
  text,
  text,
  boolean,
  integer,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_update_site_settings(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  boolean,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_publish_policy_document(
  public.policy_type,
  text,
  text,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_update_contact_status(
  uuid,
  public.contact_message_status,
  bigint,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function public.admin_mark_notifications_read(uuid[], uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_upsert_provider(
  uuid,
  text,
  boolean,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_upsert_service(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  public.price_type,
  text,
  integer,
  integer,
  integer,
  text,
  boolean,
  boolean,
  integer,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_update_business_hours(
  uuid,
  smallint,
  time,
  time,
  boolean,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_upsert_schedule_exception(
  uuid,
  uuid,
  date,
  public.schedule_exception_type,
  time,
  time,
  text,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_upsert_availability_block(
  uuid,
  uuid,
  timestamptz,
  timestamptz,
  public.availability_block_type,
  text,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_delete_schedule_exception(
  uuid,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_delete_availability_block(
  uuid,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_upsert_gallery_item(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  boolean,
  boolean,
  integer,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_upsert_testimonial(
  uuid,
  text,
  text,
  text,
  boolean,
  integer,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_upsert_faq(
  uuid,
  text,
  text,
  text,
  boolean,
  integer,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_update_site_settings(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  boolean,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_publish_policy_document(
  public.policy_type,
  text,
  text,
  uuid
) to authenticated;
grant execute on function public.admin_update_contact_status(
  uuid,
  public.contact_message_status,
  bigint,
  uuid
) to authenticated;
grant execute on function public.admin_mark_notifications_read(uuid[], uuid)
  to authenticated;
