set lock_timeout = '5s';
set statement_timeout = '60s';

do $$
declare
  v_allowed_mime_types text[] :=
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
begin
  if exists (
    select 1
    from storage.buckets as bucket
    where bucket.id = 'gallery-staging'
  ) then
    if not exists (
      select 1
      from storage.buckets as bucket
      where bucket.id = 'gallery-staging'
        and bucket.name = 'gallery-staging'
        and not bucket.public
        and bucket.file_size_limit = 12582912
        and bucket.allowed_mime_types @> v_allowed_mime_types
        and bucket.allowed_mime_types <@ v_allowed_mime_types
    ) then
      raise exception 'gallery-staging bucket configuration drift'
        using errcode = '23514';
    end if;
  else
    insert into storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    values (
      'gallery-staging',
      'gallery-staging',
      false,
      12582912,
      v_allowed_mime_types
    );
  end if;

  if exists (
    select 1
    from storage.buckets as bucket
    where bucket.id = 'gallery-public'
  ) then
    if not exists (
      select 1
      from storage.buckets as bucket
      where bucket.id = 'gallery-public'
        and bucket.name = 'gallery-public'
        and bucket.public
        and bucket.file_size_limit = 12582912
        and bucket.allowed_mime_types @> v_allowed_mime_types
        and bucket.allowed_mime_types <@ v_allowed_mime_types
    ) then
      raise exception 'gallery-public bucket configuration drift'
        using errcode = '23514';
    end if;
  else
    insert into storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    )
    values (
      'gallery-public',
      'gallery-public',
      true,
      12582912,
      v_allowed_mime_types
    );
  end if;
end;
$$;

-- No browser role receives INSERT, UPDATE, DELETE, or object-listing policies.
-- The server-only service-role client issues signed staging uploads and performs
-- reviewed finalize/cleanup operations. Public delivery is limited to objects
-- in the bucket explicitly marked public above.
