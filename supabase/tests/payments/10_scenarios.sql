\set ON_ERROR_STOP 0
create table public.availability(id uuid default gen_random_uuid(), babalawo_id uuid, day_of_week int, start_time time, end_time time, is_available boolean default true);
alter table public.babalawos add column current_status text default 'online';
create table public.babalawo_scheduling_settings(babalawo_id uuid primary key, timezone text default 'Africa/Lagos', slot_minutes int default 60, buffer_minutes int default 0, min_notice_hours int default 2, max_advance_days int default 60, accepting_bookings boolean default true);
create table public.babalawo_time_off(babalawo_id uuid, start_date date, end_date date);
create table public.availability_exceptions(babalawo_id uuid, exception_date date, kind text, start_time time, end_time time);
-- re-apply is idempotent?
\set ON_ERROR_STOP 0
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b'),('00000000-0000-0000-0000-0000000000ad'),('00000000-0000-0000-0000-00000000000c');
insert into profiles values ('00000000-0000-0000-0000-0000000000ad','admin');
insert into babalawos(user_id, hourly_rate) values ('00000000-0000-0000-0000-00000000000b', 10000);
insert into availability(babalawo_id, day_of_week, start_time, end_time) select '00000000-0000-0000-0000-00000000000b', d, '08:00','18:00' from generate_series(0,6) d;
insert into babalawo_bank_details(babalawo_id, account_name, account_number, bank_name) values ('00000000-0000-0000-0000-00000000000b','x','1','y');
create or replace function as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
grant execute on function as_user(text) to authenticated;
\echo '--- 1 client cannot call wallet fn / credit'
set role authenticated; select as_user('00000000-0000-0000-0000-00000000000a');
select public.update_wallet_balance('00000000-0000-0000-0000-00000000000a', 1000000, 'credit','admin_adjustment');
select public._wallet_apply('00000000-0000-0000-0000-00000000000a', 1000000, 'credit','admin_adjustment');
update wallets set balance = 99999999 where user_id = '00000000-0000-0000-0000-00000000000a';
insert into wallets(user_id,balance) values ('00000000-0000-0000-0000-00000000000a', 5);
select public.settle_payment_intent('x',1,'NGN','t');
select public.admin_adjust_wallet('00000000-0000-0000-0000-00000000000a', 1000, 'credit','hack');
reset role;
\echo '--- 2 top up via settlement (service role)'
set role service_role;
create temp table r as select * from public.create_payment_intent('00000000-0000-0000-0000-00000000000a','wallet_topup','paystack',20000);
select * from r;
select public.settle_payment_intent((select reference from r), 19999, 'NGN','tx1');
select public.settle_payment_intent((select reference from r), 20000, 'NGN','tx1');
select public.settle_payment_intent((select reference from r), 20000, 'NGN','tx1');
select balance from wallets where user_id='00000000-0000-0000-0000-00000000000a';
reset role;
\echo '--- 3 wallet booking: price server side, bad slot, good slot'
set role authenticated; select as_user('00000000-0000-0000-0000-00000000000a');
select public.book_session_with_wallet('00000000-0000-0000-0000-00000000000b', current_date+3, '03:00');
select public.book_session_with_wallet('00000000-0000-0000-0000-00000000000b', current_date+3, '10:00', false, 'k1') as session1;
select public.book_session_with_wallet('00000000-0000-0000-0000-00000000000b', current_date+3, '10:00', false, 'k1') as replay;
select public.book_session_with_wallet('00000000-0000-0000-0000-00000000000b', current_date+3, '10:00', false, 'k2');
select balance from wallets;
insert into sessions(user_id,babalawo_id,session_date,start_time,end_time,status,payment_status,amount) values ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b',current_date+4,'10:00','10:00','confirmed','paid',1);
update sessions set payment_status='paid', amount=1 where true;
update sessions set status='completed';
reset role;
select amount, payment_status, status from sessions;
select pending_balance, available_balance, lifetime_earned from babalawo_wallets;
\echo '--- 4 babalawo completes -> release'
set role authenticated; select as_user('00000000-0000-0000-0000-00000000000b');
update sessions set status='completed' where id=1;
update sessions set status='completed' where id=1;
select pending_balance, available_balance from my_babalawo_earnings;
select public.request_withdrawal(1000);
select public.request_withdrawal(99999);
select public.request_withdrawal(5000) as wid \gset
select pending_balance, available_balance, held_balance from my_babalawo_earnings;
update babalawos set hourly_rate = 1;
select public.set_my_session_price(500);
select public.set_my_session_price(12000, 18000);
reset role;
\echo '--- 5 admin pays withdrawal'
set role authenticated; select as_user('00000000-0000-0000-0000-0000000000ad');
select public.admin_process_withdrawal(:'wid', 'mark_paid', 'BANKREF1');
select public.admin_process_withdrawal(:'wid', 'reject');
select held_balance, lifetime_paid_out from babalawo_wallets;
select kind, status, amount from public.admin_transactions(null,null,null,20,0);
select public.admin_finance_summary();
reset role;
\echo '--- 6 refund a second paid session (client cancels early) and idempotence'
set role service_role;
create temp table r2 as select * from public.create_payment_intent('00000000-0000-0000-0000-00000000000c','session','flutterwave',null,'00000000-0000-0000-0000-00000000000b', current_date+5,'11:00',false);
select public.settle_payment_intent((select reference from r2), 12000, 'NGN','tx9');
select public.settle_payment_intent((select reference from r2), 12000, 'NGN','tx9');
reset role;
select id, amount, payment_status from sessions order by id;
set role authenticated; select as_user('00000000-0000-0000-0000-00000000000c');
select public.cancel_session(2);
select public.cancel_session(2);
reset role;
select balance from wallets where user_id='00000000-0000-0000-0000-00000000000c';
select pending_balance, available_balance, lifetime_earned from babalawo_wallets;
\echo '--- 7 slot race: settle when slot gone -> goes to wallet'
set role service_role;
create temp table r3 as select * from public.create_payment_intent('00000000-0000-0000-0000-00000000000c','session','paystack',null,'00000000-0000-0000-0000-00000000000b', current_date+3,'10:00',false);
reset role;
set role service_role;
create temp table r3 as select * from public.create_payment_intent('00000000-0000-0000-0000-00000000000c','session','paystack',null,'00000000-0000-0000-0000-00000000000b', current_date+3,'12:00',false);
reset role;
-- someone books same slot first (wallet user a)
set role authenticated; select as_user('00000000-0000-0000-0000-00000000000a');
select public.book_session_with_wallet('00000000-0000-0000-0000-00000000000b', current_date+3, '12:00', false, 'k9');
reset role;
set role service_role;
select public.settle_payment_intent((select reference from r3), 12000, 'NGN','tx77');
reset role;
select balance, user_id from wallets order by 2;
select status, failure_reason from payment_intents order by created_at desc limit 1;
-- late cancellation: a session starting in 1h is not refunded to client
update babalawo_scheduling_settings set min_notice_hours=0;
insert into babalawo_scheduling_settings(babalawo_id,min_notice_hours) values ('00000000-0000-0000-0000-00000000000b',0) on conflict do nothing;
insert into wallets(user_id,balance) values ('00000000-0000-0000-0000-00000000000c', 20000) on conflict (user_id) do update set balance=20000;
delete from availability; insert into availability(babalawo_id, day_of_week,start_time,end_time) select '00000000-0000-0000-0000-00000000000b', d,'00:00','23:59' from generate_series(0,6) d;
set role authenticated; select as_user('00000000-0000-0000-0000-00000000000c');
select public.book_session_with_wallet('00000000-0000-0000-0000-00000000000b', (now() at time zone 'Africa/Lagos')::date, to_char((now() at time zone 'Africa/Lagos') + interval '1 hour','HH24:00'), false, 'late') as sid \gset
select public.cancel_session(:sid);
reset role;
select status, payment_status from sessions where id=:sid;
select public.settle_payment_intent('nope',1,'NGN','x');
update wallets set balance=50000 where user_id='00000000-0000-0000-0000-00000000000a';
set role service_role;
create temp table r4 as select * from public.create_payment_intent('00000000-0000-0000-0000-00000000000c','session','paystack',null,'00000000-0000-0000-0000-00000000000b', current_date+6,'12:00',false);
reset role;
set role authenticated; select as_user('00000000-0000-0000-0000-00000000000a') \g /dev/null
select public.book_session_with_wallet('00000000-0000-0000-0000-00000000000b', current_date+6, '12:00', false, 'k10');
reset role;
set role service_role;
select public.settle_payment_intent((select reference from r4), 12000, 'NGN','tx78');
reset role;
select balance from wallets where user_id='00000000-0000-0000-0000-00000000000c';
select status, failure_reason from payment_intents order by created_at desc limit 1;
select count(*) from sessions where session_date=current_date+6;
