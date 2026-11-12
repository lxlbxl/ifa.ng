-- Every statement in `must_fail` has to be rejected; every `must_pass` has to succeed.
-- Fails the whole run (ON_ERROR_STOP) if the database lets an attack through.
\set ON_ERROR_STOP 1
create or replace function pg_temp.must_fail(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok   (blocked) %', label; return; end;
  raise exception 'ATTACK SUCCEEDED: %', label;
end $$;
create or replace function pg_temp.must_pass(label text, stmt text) returns void language plpgsql as $$
begin execute stmt; raise notice 'ok   (allowed) %', label; end $$;

create or replace function pg_temp.must_touch_nothing(label text, stmt text) returns void language plpgsql as $$
declare n bigint;
begin
  begin execute stmt; get diagnostics n = row_count;
  exception when others then raise notice 'ok   (blocked) %', label; return; end;
  if n > 0 then raise exception 'ATTACK SUCCEEDED: % (% rows)', label, n; end if;
  raise notice 'ok   (blocked, 0 rows) %', label;
end $$;

-- fixtures (as superuser)
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@x','{}'),
 ('00000000-0000-0000-0000-00000000000b','bab@x','{"role":"babalawo"}'),
 ('00000000-0000-0000-0000-00000000000c','cli@x','{}'),
 ('00000000-0000-0000-0000-00000000000d','evil@x','{"role":"admin"}');
insert into user_roles(user_id, role) values ('00000000-0000-0000-0000-00000000000a','admin');
do $$ begin
  if exists (select 1 from user_roles where user_id='00000000-0000-0000-0000-00000000000d' and role='admin') then
    raise exception 'ATTACK SUCCEEDED: signup metadata granted admin'; end if;
  raise notice 'ok   (blocked) signup with role=admin metadata';
end $$;
insert into sessions(user_id,babalawo_id,status,payment_status,session_date,start_time,end_time) values
 ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000b','confirmed','paid',current_date+1,'10:00','11:00'),   -- 1 paid+confirmed
 ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000b','pending','pending',current_date+1,'12:00','13:00'), -- 2 unpaid pending
 ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-00000000000b','pending','paid',current_date+1,'14:00','15:00');    -- 3 paid pending

-- ---- as a normal client
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.must_fail('client self-promotes profile role', $$update profiles set role='admin' where id=auth.uid()$$);
select pg_temp.must_fail('client writes user_roles',          $$insert into user_roles(user_id,role) values (auth.uid(),'admin')$$);
select pg_temp.must_fail('client calls admin RPC',            $$select admin_set_user_role(auth.uid(),'admin',true)$$);
select pg_temp.must_fail('client sets session room_url',      $$update sessions set room_url='https://evil.example' where id=1$$);
select pg_temp.must_fail('client reschedules directly',       $$update sessions set session_date=current_date+30 where id=1$$);
select pg_temp.must_fail('client reassigns babalawo',         $$update sessions set babalawo_id=user_id where id=1$$);
select pg_temp.must_fail('client confirms own session',       $$update sessions set status='confirmed' where id=2$$);
select pg_temp.must_fail('client completes session',         $$update sessions set status='completed' where id=1$$);
select pg_temp.must_fail('client writes consultation outcome',$$update sessions set primary_odu='x' where id=1$$);
select pg_temp.must_touch_nothing('client deletes a booking', $$delete from sessions where id=1$$);
select pg_temp.must_pass('client cancels own unpaid session', $$update sessions set status='cancelled' where id=2$$);
select pg_temp.must_fail('client reopens cancelled session',  $$update sessions set status='pending' where id=2$$);

-- ---- as the babalawo
reset role; set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.must_fail('babalawo self-verifies',            $$update babalawos set is_verified=true where user_id=auth.uid()$$);
select pg_temp.must_fail('babalawo moves unpaid session on', $$update sessions set status='confirmed' where id=2$$);
select pg_temp.must_fail('babalawo skips pending->completed', $$update sessions set status='completed' where id=3$$);
select pg_temp.must_fail('babalawo edits amount',             $$update sessions set amount=1 where id=1$$);
select pg_temp.must_fail('babalawo sets room_url',            $$update sessions set room_url='https://evil.example' where id=1$$);
select pg_temp.must_pass('babalawo confirms paid session',    $$update sessions set status='confirmed' where id=3$$);
select pg_temp.must_pass('babalawo records outcome',          $$update sessions set primary_odu='Ejiogbe', notes='ebo advised' where id=1$$);
select pg_temp.must_fail('babalawo completes before the start', $$update sessions set status='completed' where id=1$$);
select pg_temp.must_fail('babalawo starts before the start',    $$update sessions set status='in_progress' where id=1$$);
reset role; update sessions set session_date = current_date - 1 where id = 1; set role authenticated;
select pg_temp.must_pass('babalawo starts then completes',    $$update sessions set status='in_progress' where id=1; update sessions set status='completed' where id=1$$);
select pg_temp.must_fail('babalawo reopens completed',        $$update sessions set status='confirmed' where id=1$$);

-- ---- as an outsider
reset role; set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select pg_temp.must_touch_nothing('outsider cancels others session', $$update sessions set status='cancelled' where id=3$$);

-- ---- as admin
reset role; set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.must_pass('admin approves babalawo',          $$select admin_review_babalawo('00000000-0000-0000-0000-00000000000b','approved',null)$$);
select pg_temp.must_pass('admin overrides session status',   $$select admin_update_session_status(3,'in_progress')$$);
select pg_temp.must_fail('admin cannot cancel via generic RPC', $$select admin_update_session_status(3,'cancelled')$$);
select pg_temp.must_fail('admin cannot remove own admin role',  $$select admin_set_user_role(auth.uid(),'admin',false)$$);
reset role;
do $$ begin raise notice 'ALL CHECKS PASSED'; end $$;
