import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {loadConfig} from './dist/config.js';
import {createFileStore} from './dist/services/storage.js';
const names={ade:'Ade Adewale',ifemi:'Ifemi Adebayo',tunde:'Tunde Ogunleye',admin:'Femi Akinola',client:'Ayo Adeyemi',other:'Bola Akinyemi',pending:'Seyi Alabi',rejected:'Kunle Afolabi',suspended:'Segun Balogun'};
const db=new pg.Client({connectionString:process.env.MIGRATE_DATABASE_URL});await db.connect();const store=createFileStore(loadConfig());
try{
 await db.query('begin');
 for(const [key,name] of Object.entries(names)){
  const {rows}=await db.query('select id from auth.users where email=$1',[key+'@demo.ifa.test']);if(!rows.length)throw Error('Missing seeded profile '+key);
  const id=rows[0].id;const path=`avatars/${id}.jpg`;const url=`https://ifa.ng/files/${path}?v=portraits-20261108`;
  await store.put(path,await readFile(`/tmp/ifa-profile-portraits/${key}.jpg`),'image/jpeg');
  await db.query('update auth.users set name=$2,image=$3 where id=$1',[id,name,url]);
  await db.query('update public.profiles set full_name=$2,avatar_url=$3 where id=$1',[id,name,url]);
  await db.query("update public.babalawos set profile_picture_url=$2,bio=replace(bio,'[DEMO] ','') where user_id=$1",[id,url]);
  console.log('Updated',name);
 }
 await db.query('commit');
}catch(e){await db.query('rollback');throw e}finally{await db.end()}
