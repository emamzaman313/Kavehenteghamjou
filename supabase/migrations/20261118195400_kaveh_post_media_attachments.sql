create table if not exists public.post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'post-media' check (bucket_id = 'post-media'),
  object_path text not null unique,
  original_name text not null,
  mime_type text,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 50000000),
  created_at timestamptz not null default now(),
  constraint post_attachments_path_owner check (split_part(object_path, '/', 1) = author_id::text)
);

create index if not exists post_attachments_post_created_idx
  on public.post_attachments (post_id, created_at);

alter table public.post_attachments enable row level security;

grant select, insert, delete on table public.post_attachments to authenticated;

create policy post_attachments_select_visible_post
  on public.post_attachments for select to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_attachments.post_id
    )
  );

create policy post_attachments_insert_own_post
  on public.post_attachments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_attachments.post_id
        and p.author_id = (select auth.uid())
    )
  );

create policy post_attachments_delete_own
  on public.post_attachments for delete to authenticated
  using (author_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit)
values ('post-media', 'post-media', true, 50000000)
on conflict (id) do update
set public = true, file_size_limit = 50000000;

create policy post_media_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy post_media_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
