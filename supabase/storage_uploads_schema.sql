-- Storage buckets for public community media and private user media.
-- Public: avatars, reviews, community posts.
-- Private: garage photos, service receipts, personal timeline images.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'public-content-images',
    'public-content-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'private-user-images',
    'private-user-images',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read user uploads" on storage.objects;
drop policy if exists "Users can upload own files" on storage.objects;
drop policy if exists "Users can update own files" on storage.objects;
drop policy if exists "Users can delete own files" on storage.objects;

drop policy if exists "Public can read content images" on storage.objects;
drop policy if exists "Users can upload public content images" on storage.objects;
drop policy if exists "Users can update own public content images" on storage.objects;
drop policy if exists "Users can delete own public content images" on storage.objects;
drop policy if exists "Users can read own private images" on storage.objects;
drop policy if exists "Users can upload own private images" on storage.objects;
drop policy if exists "Users can update own private images" on storage.objects;
drop policy if exists "Users can delete own private images" on storage.objects;

create policy "Public can read content images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'public-content-images');

create policy "Users can upload public content images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'public-content-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own public content images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'public-content-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'public-content-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own public content images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'public-content-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read own private images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload own private images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update own private images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete own private images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'private-user-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table public.posts
add column if not exists images jsonb default '[]'::jsonb;
