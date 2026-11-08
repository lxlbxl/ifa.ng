-- Minimal stand-in for the Supabase pieces the roles/sessions migrations rely on.
-- Run against a scratch database only:  see supabase/tests/roles/README.md
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
create type user_role as enum('user','babalawo','admin');
create type session_status_enum as enum('pending','confirmed','completed','cancelled','in_progress');
create table profiles(id uuid primary key references auth.users, email text, full_name text, phone text, role user_role default 'user');
create table babalawos(id bigserial primary key, user_id uuid, is_verified boolean default false, is_featured boolean default false, is_active boolean default true, rating numeric default 0, total_sessions int default 0, commission_platform_percent numeric default 20, commission_babalawo_percent numeric default 80, hourly_rate numeric);
create table sessions(id bigserial primary key, user_id uuid, babalawo_id uuid, session_date date default current_date, start_time time default '10:00', end_time time default '11:00',
  status session_status_enum default 'pending', payment_status text default 'pending', amount numeric default 5000, payment_reference text, room_url text, notes text, primary_odu text);
create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid, type text, title text, message text);
alter table profiles enable row level security; alter table babalawos enable row level security;
alter table sessions enable row level security; alter table notifications enable row level security;
create policy p1 on profiles for all using (auth.uid()=id) with check (auth.uid()=id);
create policy b1 on babalawos for all using (user_id=auth.uid());
create policy s_sel on sessions for select using (auth.uid() in (user_id, babalawo_id));
grant usage on schema public, auth to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on function auth.uid() to authenticated, anon;
