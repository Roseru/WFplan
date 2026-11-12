import {buildPushPayload} from '@block65/webcrypto-web-push';
import data from '../data.json' with {type:'json'};
import {buildSchedule,validateSettings} from '../notification-logic.js';

// Bump with changes to scheduling rules or bundled timetable. Existing sent jobs survive rebuilds.
export const REVISION='2026-11-12-push-1';
const encoder=new TextEncoder();
export const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
export function validEndpoint(endpoint){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(u.hostname==='fcm.googleapis.com'||u.hostname==='fcmregistrations.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.notify.windows.com'));}catch{return false;}}
export function validateSubscription(s){
 if(!s||!validEndpoint(s.endpoint)||s.endpoint.length>2048||!/^[A-Za-z0-9_-]{87}=?$/.test(s.keys?.p256dh||'')||!/^[A-Za-z0-9_-]{22}={0,2}$/.test(s.keys?.auth||''))throw Error('Nieprawidłowa subskrypcja push.');
 return {endpoint:s.endpoint,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth},expirationTime:null};
}
export function validateSelection(s){
 if(!s||!data.semesters.some(x=>x.id===s.semester)||!Number.isInteger(Number(s.company))||!Number.isInteger(Number(s.platoon)))throw Error('Nieprawidłowa grupa.');
 const out={semester:s.semester,company:Number(s.company),platoon:Number(s.platoon),subgroup:String(s.subgroup||'')};
 const events=data.events.filter(e=>e.semester===out.semester&&e.company===out.company&&e.platoon===out.platoon);
 if(!events.length||out.subgroup.length>20||(out.subgroup&&!events.some(e=>e.subgroup===out.subgroup)))throw Error('Brak rozkładu dla tej grupy.');return out;
}
function ready(env){return Boolean(env.DB&&env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.DISPATCH_SECRET);}
async function replaceJobs(env,id,selection,settings,now=Date.now()){
 const jobs=buildSchedule(data,selection,settings,now).map(j=>({id:id+'|'+j.key,subscriber:id,due:j.due,starts:j.starts,payload:JSON.stringify(j.payload)}));
 return [env.DB.prepare("DELETE FROM jobs WHERE subscriber=? AND state='pending'").bind(id),env.DB.prepare("INSERT OR IGNORE INTO jobs(id,subscriber,due,starts,payload) SELECT json_extract(value,'$.id'),json_extract(value,'$.subscriber'),json_extract(value,'$.due'),json_extract(value,'$.starts'),json_extract(value,'$.payload') FROM json_each(?)").bind(JSON.stringify(jobs))];
}
async function remove(env,id){await env.DB.batch([env.DB.prepare('DELETE FROM jobs WHERE subscriber=?').bind(id),env.DB.prepare('DELETE FROM subscriptions WHERE id=?').bind(id)]);}
async function send(env,subscription,payload,ttl){
 const init=await buildPushPayload({data:JSON.stringify(payload),options:{ttl:Math.max(0,Math.min(900,ttl))}},{...subscription},{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
 return fetch(subscription.endpoint,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});
}
async function dispatch(env,id){
 const now=Date.now();
 const job=await env.DB.prepare("UPDATE jobs SET state='sending',lease=?,attempts=attempts+1 WHERE id=? AND due<=? AND (state='pending' OR (state='sending' AND lease<?)) RETURNING *").bind(now+120000,id,now,now).first();
 if(!job)return;
 if(job.starts<=now||job.due<now-900000||job.attempts>5){await env.DB.prepare("UPDATE jobs SET state='expired' WHERE id=?").bind(id).run();return;}
 const sub=await env.DB.prepare('SELECT subscription FROM subscriptions WHERE id=?').bind(job.subscriber).first();if(!sub)return;
 try{
  const response=await send(env,JSON.parse(sub.subscription),JSON.parse(job.payload),Math.floor(Math.min(job.starts-now,900000)/1000));
  if(response.status===404||response.status===410){await remove(env,job.subscriber);return;}
  if(response.ok){await env.DB.prepare("UPDATE jobs SET state='sent',sent=? WHERE id=?").bind(Date.now(),id).run();return;}
  if(response.status>=400&&response.status<500&&response.status!==429){await env.DB.prepare("UPDATE jobs SET state='failed' WHERE id=?").bind(id).run();console.error('Push rejected',response.status);return;}
 }catch{console.error('Push transport retry');}
 // The original due date is retained for the stale-message cutoff; lease controls backoff.
 await env.DB.prepare("UPDATE jobs SET state='sending',lease=? WHERE id=?").bind(now+Math.min(300000,60000*job.attempts),id).run();
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const headers={'Access-Control-Allow-Origin':env.APP_ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET,PUT,DELETE,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(url.pathname==='/internal/dispatch'){
   if(!env.DISPATCH_SECRET||request.method!=='POST'||request.headers.get('Authorization')!=='Bearer '+env.DISPATCH_SECRET)return reply({error:'Unauthorized'},401);
   const body=await request.json();if(typeof body.id!=='string'||body.id.length>400)return reply({error:'Invalid job'},400);
   await dispatch(env,body.id);return reply({ok:true});
  }
  if(origin&&origin!==env.APP_ORIGIN)return reply({error:'Origin not allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method==='GET'&&url.pathname==='/api/config')return reply({ready:ready(env),publicKey:env.VAPID_PUBLIC_KEY||null});
  if(request.method==='GET'&&url.pathname==='/health'){
   try{await env.DB.prepare('SELECT 1 FROM subscriptions LIMIT 1').first();return reply({ok:ready(env),revision:REVISION},ready(env)?200:503);}catch{return reply({ok:false},503);}
  }
  if(!ready(env))return reply({error:'Powiadomienia są chwilowo niedostępne.'},503);
  const match=url.pathname.match(/^\/api\/subscriptions\/([a-f0-9-]{36})(\/test)?$/);if(!match)return reply({error:'Not found'},404);
  const id=match[1],token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!/^[a-f0-9]{64}$/.test(token||''))return reply({error:'Brak uprawnień do subskrypcji.'},401);
  const tokenHash=await digest(token),existing=await env.DB.prepare('SELECT * FROM subscriptions WHERE id=?').bind(id).first();
  if(existing&&existing.token_hash!==tokenHash)return reply({error:'Brak uprawnień do subskrypcji.'},403);
  try{
   if(request.method==='DELETE'&&!match[2]){await remove(env,id);return reply({ok:true});}
   if(request.method==='POST'&&match[2]){
    if(!existing)return reply({error:'Najpierw włącz i zapisz powiadomienia.'},404);
    const allowed=await env.DB.prepare('UPDATE subscriptions SET last_test=? WHERE id=? AND last_test<? RETURNING id').bind(Date.now(),id,Date.now()-60000).first();
    if(!allowed)return reply({error:'Kolejny test możesz wysłać za minutę.'},429);
    const response=await send(env,JSON.parse(existing.subscription),{title:'WFplan — powiadomienia działają',body:'Otrzymasz przypomnienia dla wybranej grupy i ustawionych wyprzedzeń.',url:env.APP_ORIGIN+'/',tag:'wfplan-test'},60);
    if(response.status===404||response.status===410){await remove(env,id);return reply({error:'Subskrypcja wygasła. Wyłącz i ponownie włącz powiadomienia.'},410);}
    if(!response.ok)return reply({error:'Usługa push nie przyjęła testu. Spróbuj później.'},502);return reply({ok:true});
   }
   if(request.method!=='PUT'||match[2])return reply({error:'Method not allowed'},405);
   if(Number(request.headers.get('Content-Length'))>12000)return reply({error:'Zbyt duży zapis.'},413);
   const text=await request.text();if(text.length>12000)return reply({error:'Zbyt duży zapis.'},413);
   const body=JSON.parse(text),subscription=validateSubscription(body.subscription),selection=validateSelection(body.selection),settings=validateSettings(body.settings);
   if(!settings.enabled){await remove(env,id);return reply({ok:true});}
   const endpointHash=await digest(subscription.endpoint),other=await env.DB.prepare('SELECT id FROM subscriptions WHERE endpoint_hash=?').bind(endpointHash).first();
   if(other&&other.id!==id)return reply({error:'To urządzenie ma już subskrypcję. Wyłącz ją i włącz ponownie.'},409);
   const now=Date.now(),statements=await replaceJobs(env,id,selection,settings,now);
   await env.DB.batch([env.DB.prepare('INSERT INTO subscriptions(id,token_hash,endpoint_hash,subscription,selection,settings,revision,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,selection=excluded.selection,settings=excluded.settings,revision=excluded.revision,updated=excluded.updated').bind(id,tokenHash,endpointHash,JSON.stringify(subscription),JSON.stringify(selection),JSON.stringify(settings),REVISION,now),...statements]);
   return reply({ok:true,selection,scheduled:buildSchedule(data,selection,settings,now).length});
  }catch(error){if(error instanceof SyntaxError)return reply({error:'Nieprawidłowy zapis.'},400);if(!String(error.message).includes('D1'))return reply({error:error.message},400);console.error('Subscription database error');return reply({error:'Nie udało się zapisać ustawień. Spróbuj ponownie.'},500);}
 },
 async scheduled(controller,env,ctx){
  if(!ready(env))return;
  const stale=await env.DB.prepare('SELECT id,selection,settings FROM subscriptions WHERE revision<? ORDER BY revision LIMIT 5').bind(REVISION).all();
  for(const sub of stale.results){const statements=await replaceJobs(env,sub.id,JSON.parse(sub.selection),JSON.parse(sub.settings));await env.DB.batch([...statements,env.DB.prepare('UPDATE subscriptions SET revision=? WHERE id=?').bind(REVISION,sub.id)]);}
  const now=Date.now();
  // Daily housekeeping avoids scanning all jobs on every minute of the free D1 quota.
  const clock=new Date(now);
  if(clock.getUTCHours()===3&&clock.getUTCMinutes()===0)await env.DB.prepare("DELETE FROM jobs WHERE (starts<? AND state<>'sent') OR sent<?").bind(now-86400000,now-45*86400000).run();
  const due=await env.DB.prepare("SELECT id FROM jobs WHERE due<=? AND (state='pending' OR (state='sending' AND lease<?)) ORDER BY due LIMIT 35").bind(now,now).all();
  // Separate invocations keep encryption within the free plan's per-request CPU budget.
  ctx.waitUntil(Promise.all(due.results.map(job=>fetch(env.SERVICE_URL+'/internal/dispatch',{method:'POST',headers:{Authorization:'Bearer '+env.DISPATCH_SECRET,'Content-Type':'application/json'},body:JSON.stringify({id:job.id})}))));
 }
};
