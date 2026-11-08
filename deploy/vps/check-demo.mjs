import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
const accounts=JSON.parse(await readFile('/root/ifa-app/deploy/vps/demo-credentials.json','utf8'));
const base='https://ifa.ng';const identities={};let failures=0;
for(const a of accounts){
 // Keep sequential fixture logins below Better Auth's production rate limit.
 if(Object.keys(identities).length) await delay(15000);
 const r=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json',origin:base},body:JSON.stringify({email:a.email,password:a.password})});
 const b=await r.json();if(r.status!==200||!b.token){console.log(a.key,'LOGIN FAILED',r.status,b.error??b.message);failures++;continue;}
 identities[a.key]={token:b.token,id:b.user.id};
 const t=await fetch(base+'/v1/data-token',{headers:{authorization:'Bearer '+b.token}});const data=await t.json();
 identities[a.key].data=data.token;
 console.log(a.key,'login',r.status,'data token',t.status);
}
const get=async(k,path)=>{const pgrst=path.startsWith('/rest/');const i=identities[k];const r=await fetch(base+path,{headers:i?{authorization:'Bearer '+(pgrst?i.data:i.token)}:{}});let body;try{body=await r.json()}catch{body=null}return {r,body}};
for(const k of ['client','other','ade','admin']){
 const {r,body}=await get(k,'/rest/v1/sessions?select=id,user_id,babalawo_id&order=id');
 console.log(k,'visible sessions',r.status,Array.isArray(body)?body.length:JSON.stringify(body));
 if(r.status!==200||!Array.isArray(body))failures++;
 if(k==='other'&&Array.isArray(body)&&body.some(s=>s.user_id!==identities.other.id))failures++;
}
for(const [k,expected] of [['ade',200],['admin',200],['other',403]]){
 const {r,body}=await get(k,'/v1/sessions/900001/recording');console.log(k,'recording permission',r.status);
 if(r.status!==expected)failures++;
 if(r.status===200){const f=await fetch(body.url);console.log('Signed recording',f.status,f.headers.get('content-type'));if(f.status!==200)failures++;}
}
const profile=await get('ade',`/rest/v1/profiles?id=eq.${identities.ade.id}&select=avatar_url`);
const avatar=await fetch(profile.body[0].avatar_url);console.log('Avatar',avatar.status,avatar.headers.get('content-type'));if(avatar.status!==200)failures++;
const notes=await get('client','/rest/v1/consultation_notes?select=session_id,status');console.log('Client notes',notes.r.status,notes.body.length,'draft hidden:',notes.body.every(n=>n.status!=='draft'));if(notes.body.some(n=>n.status==='draft'))failures++;
console.log('Failures',failures);process.exitCode=failures?1:0;
