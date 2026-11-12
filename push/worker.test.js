import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createECDH,randomBytes,hkdfSync,createDecipheriv,createPublicKey,verify} from 'node:crypto';
import worker,{validEndpoint,validateSelection,digest} from './worker.js';
import {defaultSettings} from '../notification-logic.js';

function database(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 const prepare=sql=>({bind(...args){return {first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>db.prepare(sql).run(...args)};},first:async()=>db.prepare(sql).get()||null,all:async()=>({results:db.prepare(sql).all()}),run:async()=>db.prepare(sql).run()});
 return {raw:db,prepare,batch:async statements=>{db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
function fixture(){
 const vapid=createECDH('prime256v1');vapid.generateKeys();const recipient=createECDH('prime256v1');recipient.generateKeys();const auth=randomBytes(16);
 const env={DB:database(),APP_ORIGIN:'https://wfplan-wat.github.io',SERVICE_URL:'https://wfplan-push.example.workers.dev',VAPID_SUBJECT:'https://wfplan-wat.github.io',VAPID_PUBLIC_KEY:vapid.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:vapid.getPrivateKey().toString('base64url'),DISPATCH_SECRET:randomBytes(32).toString('hex')};
 const id=crypto.randomUUID(),token=randomBytes(32).toString('hex'),subscription={endpoint:'https://fcm.googleapis.com/fcm/send/controlled-test',keys:{p256dh:recipient.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}};
 const settings=defaultSettings();settings.enabled=true;const selection={semester:'winter-2026',company:23,platoon:4,subgroup:''};
 const call=(method,body,path='',authToken=token,origin=env.APP_ORIGIN)=>worker.fetch(new Request(env.SERVICE_URL+'/api/subscriptions/'+id+path,{method,headers:{Authorization:'Bearer '+authToken,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
 return {env,id,token,subscription,settings,selection,call,recipient,auth,vapid};
}
function decrypt(f,init){
 const body=Buffer.from(init.body),salt=body.subarray(0,16),keyLength=body[20],serverKey=body.subarray(21,21+keyLength),ciphertext=body.subarray(21+keyLength);
 const shared=f.recipient.computeSecret(serverKey),info=Buffer.concat([Buffer.from('WebPush: info\0'),f.recipient.getPublicKey(),serverKey]);
 const ikm=hkdfSync('sha256',shared,f.auth,info,32),key=hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16),nonce=hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12);
 const cipher=createDecipheriv('aes-128-gcm',key,nonce);cipher.setAuthTag(ciphertext.subarray(-16));const clear=Buffer.concat([cipher.update(ciphertext.subarray(0,-16)),cipher.final()]);let end=clear.length-1;while(clear[end]===0)end--;assert.equal(clear[end],2);return JSON.parse(clear.subarray(0,end).toString());
}
test('Push endpoints prevent SSRF; only real browser push services accepted',()=>{
 for(const e of ['http://fcm.googleapis.com/test','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.example/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x'])assert.equal(validEndpoint(e),false,e);
 for(const e of ['https://fcm.googleapis.com/x','https://updates.push.services.mozilla.com/wpush/v2/x','https://web.push.apple.com/x','https://wns2-par02p.notify.windows.com/x'])assert.equal(validEndpoint(e),true,e);
 assert.throws(()=>validateSelection({semester:'winter-2026',company:23,platoon:99}));
});
test('D1 registration/replacement/delete, authorization and exact origin checks',async()=>{
 const f=fixture(),body={subscription:f.subscription,settings:f.settings,selection:f.selection};
 assert.equal((await f.call('PUT',body,'',f.token,'https://evil.example')).status,403);
 assert.equal((await f.call('PUT',body)).status,200);let count=f.env.DB.raw.prepare('SELECT count(*) n FROM jobs').get().n;assert.ok(count>0);
 assert.equal((await f.call('PUT',body,'','a'.repeat(64))).status,403);assert.equal((await f.call('DELETE',null,'','bad')).status,401);
 assert.equal((await f.call('PUT',body)).status,200);assert.equal(f.env.DB.raw.prepare('SELECT count(*) n FROM jobs').get().n,count);
 const job=f.env.DB.raw.prepare('SELECT id FROM jobs LIMIT 1').get();f.env.DB.raw.prepare("UPDATE jobs SET state='sent',sent=? WHERE id=?").run(Date.now(),job.id);
 await f.call('PUT',body);assert.equal(f.env.DB.raw.prepare('SELECT state FROM jobs WHERE id=?').get(job.id).state,'sent');assert.equal(f.env.DB.raw.prepare('SELECT count(*) n FROM jobs').get().n,count);
 f.settings.wf.enabled=false;await f.call('PUT',body);assert.ok(f.env.DB.raw.prepare('SELECT count(*) n FROM jobs').get().n<count);
 assert.equal((await f.call('DELETE')).status,200);assert.equal(f.env.DB.raw.prepare('SELECT count(*) n FROM subscriptions').get().n,0);assert.equal(f.env.DB.raw.prepare('SELECT count(*) n FROM jobs').get().n,0);
});
test('Real RFC8291 payload decrypts and VAPID signature verifies; test limited to own subscription',async()=>{
 const f=fixture();await f.call('PUT',{subscription:f.subscription,settings:f.settings,selection:f.selection});
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{
  assert.equal(url,f.subscription.endpoint);assert.equal(init.redirect,'manual');calls++;const payload=decrypt(f,init);assert.equal(payload.title,'WFplan — powiadomienia działają');assert.equal(init.headers['content-encoding'],'aes128gcm');
  const [,jwt]=init.headers.authorization.match(/t=([^,]+)/),[header,claims,signature]=jwt.split('.');const publicBytes=f.vapid.getPublicKey();
  const key=createPublicKey({key:{kty:'EC',crv:'P-256',x:publicBytes.subarray(1,33).toString('base64url'),y:publicBytes.subarray(33).toString('base64url')},format:'jwk'});
  assert.ok(verify('sha256',Buffer.from(header+'.'+claims),{key,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));const claim=JSON.parse(Buffer.from(claims,'base64url'));assert.equal(claim.aud,'https://fcm.googleapis.com');assert.equal(claim.sub,f.env.VAPID_SUBJECT);return new Response(null,{status:201});
 };
 try{const response=await f.call('POST',null,'/test');assert.equal(response.status,200,await response.text());assert.equal((await f.call('POST',null,'/test')).status,429);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('Cron dispatch claims atomically, sends once, expires old reminders and cleans up gone endpoints',async()=>{
 const f=fixture();await f.call('PUT',{subscription:f.subscription,settings:f.settings,selection:f.selection});f.env.DB.raw.exec('DELETE FROM jobs');
 const now=Date.now(),insert=(id,due,starts)=>f.env.DB.raw.prepare('INSERT INTO jobs(id,subscriber,due,starts,payload) VALUES(?,?,?,?,?)').run(id,f.id,due,starts,JSON.stringify({title:'Controlled reminder',body:'Topic',url:f.env.APP_ORIGIN,tag:id}));
 insert('due',now-1000,now+3600000);insert('stale',now-1000000,now+3600000);insert('past',now-1000,now-1);
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{if(url===f.subscription.endpoint){calls++;assert.equal(decrypt(f,init).title,'Controlled reminder');return new Response(null,{status:201});}return worker.fetch(new Request(url,init),f.env);};
 try{let pending;await worker.scheduled({},f.env,{waitUntil:p=>{pending=p;}});await pending;assert.equal(calls,1);assert.equal(f.env.DB.raw.prepare("SELECT state FROM jobs WHERE id='due'").get().state,'sent');assert.equal(f.env.DB.raw.prepare("SELECT state FROM jobs WHERE id='stale'").get().state,'expired');
  await worker.scheduled({},f.env,{waitUntil:p=>{pending=p;}});await pending;assert.equal(calls,1);
  insert('gone',now-1,now+3600000);globalThis.fetch=async(url,init)=>url===f.subscription.endpoint?new Response(null,{status:410}):worker.fetch(new Request(url,init),f.env);
  await worker.scheduled({},f.env,{waitUntil:p=>{pending=p;}});await pending;assert.equal(f.env.DB.raw.prepare('SELECT count(*) n FROM subscriptions').get().n,0);
 }finally{globalThis.fetch=original;}
});
test('Transient push failures retry after a lease, and never immediately duplicate a send',async()=>{
 const f=fixture();await f.call('PUT',{subscription:f.subscription,settings:f.settings,selection:f.selection});f.env.DB.raw.exec('DELETE FROM jobs');const now=Date.now();
 f.env.DB.raw.prepare('INSERT INTO jobs(id,subscriber,due,starts,payload) VALUES(?,?,?,?,?)').run('retry',f.id,now-1000,now+3600000,JSON.stringify({title:'Retry'}));
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{if(url!==f.subscription.endpoint)return worker.fetch(new Request(url,init),f.env);calls++;return new Response(null,{status:calls===1?503:201});};
 const tick=async()=>{let pending;await worker.scheduled({},f.env,{waitUntil:p=>{pending=p;}});await pending;};
 try{await tick();assert.equal(calls,1);assert.equal(f.env.DB.raw.prepare("SELECT state FROM jobs WHERE id='retry'").get().state,'sending');await tick();assert.equal(calls,1);f.env.DB.raw.prepare("UPDATE jobs SET lease=0 WHERE id='retry'").run();await tick();assert.equal(calls,2);assert.equal(f.env.DB.raw.prepare("SELECT state FROM jobs WHERE id='retry'").get().state,'sent');}finally{globalThis.fetch=original;}
});
