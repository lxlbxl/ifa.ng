
-- This creates a public "avatars" storage bucket for user profile images
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;
