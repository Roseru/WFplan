import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {BLOCK_STARTS,PLACE_LABELS,defaultSettings,validateSettings,eventStart,eventKind,notificationPlace,notificationPayload,buildSchedule,leadText} from './notification-logic.js';
const data=JSON.parse(fs.readFileSync(new URL('./data.json',import.meta.url))),sel={semester:'winter-2026',company:23,platoon:4};
test('Agreed presets, independently switchable and bounded custom leads',()=>{
 const s=defaultSettings();assert.equal(s.enabled,false);assert.deepEqual(s.wf.reminders.map(r=>r.minutes),[1440,60]);assert.deepEqual(s.methodical.reminders.map(r=>r.minutes),[10080,2880,1440,60]);assert.deepEqual(validateSettings(s),s);
 for(const minutes of [0,-1,1.2,43201,Infinity]){s.wf.reminders=[{minutes,enabled:true}];assert.throws(()=>validateSettings(s));}
 s.wf.reminders=[{minutes:17,enabled:true},{minutes:17,enabled:false}];assert.throws(()=>validateSettings(s),/dwa razy/);
});
test('All place aliases and building/attire exceptions are covered',()=>{
 assert.deepEqual(Object.keys(PLACE_LABELS).sort(),Object.keys(data.locations).sort());
 for(const location of Object.keys(data.locations)){const e={location,topic:2,lesson:'2/24'};const suffix=location==='P'||data.locations[location].outdoor?'':' (CZYSTE OBUWIE)';assert.equal(notificationPlace(e,data),PLACE_LABELS[location]+suffix);}
 assert.equal(notificationPlace({location:'B2',topic:4},data),'BALON (MUNDUR)');assert.equal(notificationPlace({location:'T',topic:4},data),'TEREN (MUNDUR)');assert.equal(notificationPlace({location:'P',topic:4},data),'BASEN');
});
test('All blocks convert Warsaw winter/summer hours and DST correctly',()=>{
 for(const [block,time] of Object.entries(BLOCK_STARTS)){assert.equal(new Date(eventStart({date:'2026-11-30',block})).toISOString(),`2026-11-30T${String(+time.slice(0,2)-1).padStart(2,'0')}:${time.slice(3)}:00.000Z`);}
 assert.equal(new Date(eventStart({date:'2026-10-23',block:'1–2'})).toISOString(),'2026-10-23T06:00:00.000Z');assert.equal(new Date(eventStart({date:'2026-10-26',block:'1–2'})).toISOString(),'2026-10-26T07:00:00.000Z');assert.equal(eventStart({date:'2026-11-30',block:''}),null);
});
test('Exact Polish titles, aliases, full topic and click-through group/date',()=>{
 const e={...data.events.find(e=>e.lesson==='4/27'),location:'B2'};const p=notificationPayload(e,data,2880);assert.equal(p.title,'METODYKA za 2 dni — BALON (MUNDUR)');assert.ok(p.body.startsWith(data.lessons['4/27'].title));const u=new URL(p.url);assert.equal(u.searchParams.get('date'),e.date);assert.equal(u.searchParams.get('platoon'),String(e.platoon));
 assert.equal(leadText(60),'za godzinę');assert.equal(leadText(1440),'za dzień');assert.equal(leadText(22),'za 22 minuty');assert.equal(leadText(12),'za 12 minut');
 const ordinary={...e,lesson:'2/24',topic:'2',location:'H'};assert.equal(notificationPayload(ordinary,data,60).title,'WF za godzinę — SWF (CZYSTE OBUWIE)');
});
test('Overrides: Nov9 ordinary replacement, Nov30 methodical makeup; never double WF/IM',()=>{
 const replaced=data.events.find(e=>e.company===23&&e.platoon===4&&e.date==='2026-11-09'&&e.lesson==='2/32'),makeup=data.events.find(e=>e.company===23&&e.platoon===4&&e.date==='2026-11-30'&&e.lesson==='2/24');
 assert.equal(eventKind(replaced,data),'wf');assert.equal(eventKind(makeup,data),'methodical');assert.match(notificationPayload(makeup,data,60).body,/Doskonalenie biegu na orientację/);
 const s=defaultSettings();s.enabled=true;const jobs=buildSchedule(data,sel,s,Date.parse('2026-10-01T00:00:00Z'));assert.equal(jobs.filter(j=>j.key.includes('2026-11-30')).length,4);assert.ok(jobs.filter(j=>j.key.includes('2026-11-30')).every(j=>j.payload.title.startsWith('METODYKA')));
 const single={...data,events:[makeup,makeup]};assert.equal(buildSchedule(single,sel,s,0).length,4);
 s.methodical.enabled=false;assert.equal(buildSchedule(single,sel,s,0).length,0);s.methodical.enabled=true;s.methodical.reminders[0].enabled=false;assert.equal(buildSchedule(single,sel,s,0).length,3);
});
test('No stale reminders, strict group/subgroup scope, defaults off',()=>{
 const s=defaultSettings();assert.equal(buildSchedule(data,sel,s,0).length,0);s.enabled=true;
 const now=Date.parse('2026-11-12T10:00:00Z'),jobs=buildSchedule(data,sel,s,now);assert.ok(jobs.length>0);assert.ok(jobs.every(j=>j.due>now&&j.starts>j.due));assert.ok(jobs.every(j=>new URL(j.payload.url).searchParams.get('company')==='23'&&new URL(j.payload.url).searchParams.get('platoon')==='4'));
 s.wf.enabled=false;s.methodical.enabled=false;assert.equal(buildSchedule(data,sel,s,now).length,0);
});
test('Every timetable notification fits the encrypted Web Push payload limit',()=>{
 for(const e of data.events)assert.ok(new TextEncoder().encode(JSON.stringify(notificationPayload(e,data,10080))).length<=3993,e.code);
});
