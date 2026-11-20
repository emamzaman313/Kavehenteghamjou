alter table public.profiles
  add column if not exists profile_theme jsonb not null default '{"accent":"#168bff","surface":"#101b2c","text":"#f4f1eb"}'::jsonb,
  add column if not exists profile_music_path text,
  add column if not exists profile_music_title text,
  add column if not exists featured_badges text[] not null default '{}'::text[];
alter table public.profiles drop constraint if exists profiles_profile_theme_object_check;
alter table public.profiles add constraint profiles_profile_theme_object_check check (jsonb_typeof(profile_theme) = 'object');
alter table public.profiles drop constraint if exists profiles_profile_music_title_length_check;
alter table public.profiles add constraint profiles_profile_music_title_length_check check (profile_music_title is null or char_length(profile_music_title) <= 120);
update storage.buckets set allowed_mime_types = (select array_agg(distinct mime_type) from unnest(coalesce(allowed_mime_types, array[]::text[]) || array['image/gif']) as mime_type) where id = 'profile-media';
create table if not exists public.platform_feature_flags (
  key text primary key,
  title text not null,
  description text not null default '',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.platform_feature_flags enable row level security;
grant select on public.platform_feature_flags to anon, authenticated;
drop policy if exists platform_feature_flags_public_read on public.platform_feature_flags;
create policy platform_feature_flags_public_read on public.platform_feature_flags for select to anon, authenticated using (true);
insert into public.platform_feature_flags(key,title,description,enabled) values
 ('posts','انتشار پست','امکان ایجاد پست جدید برای کاربران',true),
 ('reels','ریلز','امکان انتشار ریلز جدید',true),
 ('chat','گفتگوها','امکان شروع گفتگوهای جدید',true),
 ('uploads','بارگذاری فایل','امکان بارگذاری فایل و رسانه',true),
 ('support','پشتیبانی','دسترسی به مرکز پشتیبانی کاربران',true),
 ('social_discovery','اکتشاف','جستجو و کشف کاربران و محتوا',true)
on conflict (key) do nothing;