import pg from 'pg';
import {hashPassword} from 'better-auth/crypto';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {loadConfig} from './dist/config.js';
import {createFileStore} from './dist/services/storage.js';
const accounts=JSON.parse(await readFile('/tmp/ifa-demo-credentials.json','utf8'));
const uid=k=>{let h=createHash('sha256').update('ifa-demo-v1:'+k).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`};
const user=k=>uid('user:'+k);
const db=new pg.Client({connectionString:process.env.MIGRATE_DATABASE_URL});await db.connect();
const insert=async(table,row)=>{
 const keys=Object.keys(row);const vals=Object.values(row).map(v=>v!==null&&typeof v==='object'&&!Array.isArray(v)?JSON.stringify(v):v);
 return db.query(`insert into ${table} (${keys.map(k=>'"'+k+'"').join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) on conflict do nothing returning *`,vals);
};
const store=createFileStore(loadConfig());
try{
await db.query('begin');
if((await db.query('select 1 from public.admin_audit_log where id=$1',[uid('seed-audit')])).rowCount){console.log('Demo seed already exists; no balances or account data changed.');await db.query('rollback');await db.end();process.exit(0);}

for(const a of accounts){
 const id=user(a.key);
 const existing=await db.query('select id from auth.users where email=$1',[a.email]);
 if(existing.rows.length&&existing.rows[0].id!==id)throw Error('Fixture email collision');
 await insert('auth.users',{id,email:a.email,name:a.name,email_verified:true,signup_role:a.role==='babalawo'?'babalawo':'user'});
 await insert('auth.accounts',{id:uid('account:'+a.key),user_id:id,account_id:id,provider_id:'credential',password:await hashPassword(a.password)});
 if(a.role==='admin')await insert('public.user_roles',{user_id:id,role:'admin'});
 await db.query('update public.profiles set full_name=$2,whatsapp_opt_in=false,sms_opt_in=false where id=$1',[id,a.name]);
 if(a.key==='suspended')await db.query("update public.profiles set is_suspended=true,suspended_reason='[DEMO] Testing suspended-account access',suspended_at=now() where id=$1",[id]);
 await insert('public.user_notification_preferences',{user_id:id,email:false,sms:false,session_reminders:false,payment_updates:false});
 if(a.role!=='babalawo')continue;
 const approved=['ade','ifemi','tunde'].includes(a.key);const idx=['ade','ifemi','tunde','pending','rejected'].indexOf(a.key);
 const avatar=`avatars/${id}.png`;
 const initials=a.key.slice(0,2).toUpperCase();
 await store.put(avatar,await readFile(`/tmp/ifa-demo-assets/${a.key}.png`),'image/png');
 await db.query(`update public.babalawos set bio=$2,specialties=$3,languages=$4,experience_years=$5,hourly_rate=$6,session_price=$6,instant_price=$7,commission_babalawo_percent=80,commission_platform_percent=20,rating=$8,total_sessions=4,city=$9,region=$9,country='Nigeria',timezone='Africa/Lagos',is_verified=$10,is_featured=$10,is_active=true,review_status=$11,current_status='online',profile_picture_url=$12 where user_id=$1`,[id,'[DEMO] Fictional profile for testing search, booking and dashboard features. Not a real practitioner.', ['Life guidance','Family','Career'][idx%3].split(','),idx===1?['English','Yoruba','French']:['English','Yoruba'],10+idx*3,15000+idx*5000,20000+idx*5000,4.5+idx*.1,['Lagos','Ibadan','Osogbo','Ile-Ife','Lagos'][idx],approved,approved?'approved':a.key==='rejected'?'rejected':'pending',`https://ifa.ng/files/${avatar}`]);
 await db.query('update public.profiles set avatar_url=$2 where id=$1',[id,`https://ifa.ng/files/${avatar}`]);
 for(let day=0;day<7;day++)await insert('public.availability',{id:uid(`availability:${a.key}:${day}`),babalawo_id:id,day_of_week:day,start_time:'09:00',end_time:'18:00',is_available:true});
 await insert('public.babalawo_scheduling_settings',{babalawo_id:id,timezone:'Africa/Lagos',slot_minutes:60,buffer_minutes:0,min_notice_hours:2,max_advance_days:60,accepting_bookings:approved});
}
for(const k of ['client','other']){
 const id=user(k);
 const wallet=(await db.query('select id from public.wallets where user_id=$1',[id])).rows[0]?.id??uid('wallet:'+k);
 await insert('public.wallets',{id:wallet,user_id:id,balance:250000});
 await db.query('update public.wallets set balance=250000 where user_id=$1',[id]);
 await insert('public.wallet_transactions',{id:uid('wallet-topup:'+k),wallet_id:wallet,user_id:id,amount:250000,transaction_type:'credit',transaction_source:'admin_adjustment',description:'[DEMO] Fictional test credit — no money received',balance_after:250000,idempotency_key:'DEMO-v1-wallet-'+k});
}
const scenarios=[['completed',-10,'paid'],['completed',-7,'paid'],['completed',-5,'paid'],['completed',-3,'paid'],['confirmed',2,'paid'],['confirmed',3,'paid'],['pending',4,'pending'],['cancelled',-2,'refunded'],['cancelled',-1,'failed'],['confirmed',5,'paid'],['pending',6,'pending'],['completed',-12,'paid']];
for(let i=0;i<scenarios.length;i++){
 const sid=900001+i;const [status,offset,payment]=scenarios[i];const k=['ade','ifemi','tunde'][i%3];const client=user(i===11?'other':'client');const baba=user(k);const reference='DEMO-v1-session-'+sid;
 const date=(await db.query("select (current_date+$1::int)::text as date",[offset])).rows[0].date;
 const found=await db.query('select idempotency_key from public.sessions where id=$1',[sid]);if(found.rows.length&&found.rows[0].idempotency_key!==reference)throw Error('Session ID collision');
 await insert('public.sessions',{id:sid,user_id:client,babalawo_id:baba,session_date:date,start_time:`${10+i%4}:00`,end_time:`${11+i%4}:00`,status,payment_status:payment,amount:15000+(i%3)*5000,payment_reference:reference,idempotency_key:reference,reminder_sent:true,recording_status:status==='completed'?'notes_drafted':'none',notes:'[DEMO] Fictional test session. No live video room or real payment.'});
 if(payment!=='pending')await insert('public.payments',{id:uid('payment:'+sid),user_id:client,babalawo_id:baba,session_id:sid,amount:15000+(i%3)*5000,babalawo_amount:(15000+(i%3)*5000)*.8,commission_amount:(15000+(i%3)*5000)*.2,payment_gateway:'demo',payment_reference:reference,status:payment,currency:'NGN',idempotency_key:reference,webhook_verified:false});
 await insert('public.session_logs',{id:uid('log:'+sid),session_id:sid,user_id:client,action:'demo_seed',metadata:{demo:true,scenario:status,payment}});
 if(status==='completed'){
  const rid=uid('recording:'+sid),tid=uid('transcript:'+sid);
  await insert('public.session_consents',{id:uid('consent-client:'+sid),session_id:sid,user_id:client,party:'client',recording_consent:true,ai_processing_consent:true,consent_version:'DEMO-v1'});
  await insert('public.session_consents',{id:uid('consent-baba:'+sid),session_id:sid,user_id:baba,party:'babalawo',recording_consent:true,ai_processing_consent:true,consent_version:'DEMO-v1'});
  await insert('public.session_recordings',{id:rid,session_id:sid,source:'upload',storage_path:'demo-tone.wav',status:'done',duration_seconds:2});
  await insert('public.session_transcripts',{id:tid,session_id:sid,recording_id:rid,source:'demo',language:'en',text:'[DEMO] This is a fictional transcript to test consent, recording playback and consultation notes. No actual consultation took place.',confidence:.98,needs_review:false});
  await insert('public.consultation_notes',{id:uid('notes:'+sid),session_id:sid,status:i===3?'draft':'approved',source:'manual',summary:'[DEMO] Fictional consultation summary for testing the notes workflow.',action_points:JSON.stringify([{text:'[DEMO] Review the sample notes',completed:false}]),primary_odu:'[DEMO] Èjì Ogbè',items_needed:'[DEMO] No real items required',language:'en',transcript_id:tid,approved_by:i===3?null:baba,approved_at:i===3?null:new Date().toISOString()});
  await insert('public.ebo_prescriptions',{id:uid('ebo:'+sid),session_id:sid,babalawo_id:baba,client_id:client,kind:'other',title:'[DEMO] Sample follow-up task',description:'Fictional task to test progress and deadlines; not spiritual or medical advice.',items:'[DEMO] No real materials needed',status:i===2?'completed':'prescribed',estimated_cost:0,due_date:date});
  await insert('public.reviews',{id:900001+i,session_id:sid,user_id:client,babalawo_id:baba,rating:i%2?4:5,comment:'[DEMO] Fictional review to test the review and moderation screens.',is_approved:i!==3});
 }
 if(payment==='refunded')await insert('public.refunds',{id:uid('refund:'+sid),payment_id:uid('payment:'+sid),amount:15000+(i%3)*5000,reason:'[DEMO] Test cancellation refund',status:'completed',processed_by:user('admin')});
 if(i===2)await insert('public.disputes',{id:uid('dispute:'+sid),session_id:sid,raised_by:client,reason:'[DEMO] Fictional dispute for testing admin review.',status:'open',refund_requested:false});
}
for(const k of ['ade','ifemi','tunde']){
 const baba=user(k);
 await insert('public.babalawo_wallets',{babalawo_id:baba,available_balance:40000,pending_balance:12000,held_balance:5000,lifetime_earned:65000,lifetime_paid_out:8000});
 await db.query('update public.babalawo_wallets set available_balance=40000,pending_balance=12000,held_balance=5000,lifetime_earned=65000,lifetime_paid_out=8000 where babalawo_id=$1',[baba]);
 await insert('public.babalawo_ledger',{id:uid('ledger-earning:'+k),babalawo_id:baba,entry_type:'adjustment',amount:65000,note:'[DEMO] Fictional earnings fixture'});
 await insert('public.withdrawal_requests',{id:uid('withdrawal:'+k),babalawo_id:baba,amount:5000,status:'pending',reason:'[DEMO] Test withdrawal — do not pay',bank_snapshot:{demo:true,bank_name:'DEMO — not a real bank',account_number:'0000000000'}});
 await insert('public.payouts',{id:uid('payout:'+k),babalawo_id:baba,amount:8000,method:'demo',reference:'DEMO-v1-payout-'+k,status:'completed'});
}
await insert('public.availability_exceptions',{id:uid('exception'),babalawo_id:user('ade'),exception_date:(await db.query("select (current_date+8)::text as date")).rows[0].date,kind:'blocked',reason:'[DEMO] Sample blocked day'});
for(const a of accounts)await insert('public.notifications',{id:uid('notification:'+a.key),user_id:user(a.key),type:'system',title:'[DEMO] Test account ready',message:'This is fictional seed data. Payments and balances are not real.',action_url:'/dashboard',action_label:'Open dashboard',read:false,data:{demo:true}});

for(const k of ['ade','ifemi','tunde'])await insert('public.babalawo_bank_details',{babalawo_id:user(k),bank_name:'DEMO — not a real bank',account_number:'0000000000',account_name:'DEMO FIXTURE — DO NOT PAY'});
const dates=(await db.query("select (current_date+10)::text as start, (current_date+12)::text as finish, (current_date+7)::text as due")).rows[0];
await insert('public.babalawo_time_off',{id:uid('timeoff'),babalawo_id:user('ifemi'),start_date:dates.start,end_date:dates.finish,reason:'[DEMO] Time-off test'});
await insert('public.reminders',{id:uid('reminder'),user_id:user('client'),reminder_type:'followup',title:'[DEMO] Review sample consultation notes',description:'Fictional in-app reminder',reminder_date:dates.due+'T12:00:00Z',is_completed:false});
const babarow=(await db.query('select id from public.babalawos where user_id=$1',[user('ade')])).rows[0];
await insert('public.ritual_reminders',{id:uid('ritual-reminder'),user_id:user('client'),babalawo_id:babarow.id,ritual_type:'demo',title:'[DEMO] Sample follow-up',description:'Fixture only; no ritual or action required',due_date:dates.due,status:'pending'});
for(const [i,status] of [[0,'succeeded'],[6,'pending'],[8,'failed']])await insert('public.payment_intents',{id:uid('intent:'+i),user_id:user('client'),kind:'session',gateway:'paystack',reference:'DEMO-v1-intent-'+i,amount:15000,babalawo_user_id:user(['ade','ifemi','tunde'][i%3]),status,session_id:900001+i,failure_reason:status==='failed'?'[DEMO] Simulated decline':null});
await insert('public.notification_outbox',{id:uid('skipped-message'),session_id:900005,kind:'reminder_24h',dedupe_key:'DEMO-v1-skipped-message',status:'skipped',last_error:'[DEMO] Fixture only — outbound messaging intentionally not queued'});
await insert('public.admin_audit_log',{id:uid('seed-audit'),admin_id:user('admin'),action:'demo_seed',target_type:'demo_fixtures',target_id:'v1',details:{demo:true,accounts:accounts.length,sessions:scenarios.length}});
await store.put('session-recordings/demo-tone.wav',await readFile('/tmp/ifa-demo-assets/demo-tone.wav'),'audio/wav');
await db.query('commit');console.log(JSON.stringify({accounts:accounts.length,sessions:scenarios.length,status:'seed committed'}));
}catch(e){await db.query('rollback');throw e;}finally{await db.end();}
