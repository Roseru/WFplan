import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {addDays,monday,filterEvents,ics,isMethodicalEvent,isMakeupEvent,methodicalLabel} from './logic.js';
const data=JSON.parse(fs.readFileSync(new URL('./data.json',import.meta.url)));
test('Reference example: 4pl/23kp, Friday 9 October 2026',()=>{const events=filterEvents(data.events,{semester:'winter-2026',company:23,platoon:4});const e=events.find(e=>e.date==='2026-10-09');assert.equal(e.code,'O-2/33');assert.equal(e.cell,'F413');assert.equal(e.block,'3–4');assert.equal(e.instructor,'PS');assert.equal(data.lessons[e.lesson].page,15);assert.equal(data.lessons[e.lesson].hours,2);assert.equal(data.lessons[e.lesson].type,'instruktorsko-metodyczne');assert.equal(data.lessons[e.lesson].title,'Doskonalenie umiejętności indywidualnego pokonywania toru przeszkód w OSF.');});
test('Summer archive keeps 2026 dates, no fabricated 2027 summer',()=>{const summer=data.events.filter(e=>e.semester==='summer-2026');assert.ok(summer.length>1000);assert.ok(summer.every(e=>e.date.startsWith('2026-')));assert.equal(data.events.filter(e=>e.semester==='summer-2027').length,0);assert.ok(data.semesters.find(s=>s.id==='summer-2027').warning);});
test('Every entry retains provenance and valid calendar dates',()=>{const keys=new Set();for(const e of data.events){assert.match(e.cell,/^[A-Z]+\d+$/);assert.ok(e.company>=1&&e.platoon>=1);assert.equal(new Date(e.date+'T12:00:00Z').toISOString().slice(0,10),e.date);const key=e.sheet+e.cell;assert.ok(!keys.has(key));keys.add(key);}assert.equal(data.events.length,7511);});
test('Unmatched source codes stay unmatched',()=>{assert.equal(data.lessons['18/9'],undefined);assert.ok(data.events.some(e=>e.lesson==='4/710'));assert.equal(data.lessons['4/710'],undefined);});
test('Date navigation respects month/year and daylight-saving boundaries',()=>{assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(addDays('2026-10-25',1),'2026-10-26');assert.equal(monday('2026-10-11'),'2026-10-05');});
test('Subgroups include shared entries but exclude a different subgroup',()=>{const e=[{semester:'x',company:1,platoon:1,subgroup:'A',date:'2026-10-01',block:'1–2',cell:'A1'},{semester:'x',company:1,platoon:1,subgroup:'B',date:'2026-10-01',block:'1–2',cell:'A2'},{semester:'x',company:1,platoon:1,subgroup:'',date:'2026-10-01',block:'1–2',cell:'A3'}];assert.deepEqual(filterEvents(e,{semester:'x',company:1,platoon:1,subgroup:'A'}).map(e=>e.cell),['A1','A3']);});
test('Calendar exports all-day entries without inventing start times',()=>{const e=data.events.find(e=>e.cell==='F413'&&e.semester==='winter-2026');const output=ics([e],data);assert.match(output,/DTSTART;VALUE=DATE:20261009/);assert.match(output,/DTEND;VALUE=DATE:20261010/);assert.match(output,/TRANSP:TRANSPARENT/);assert.ok(output.split('\r\n').every(line=>Buffer.byteLength(line)<=75));assert.equal((output.match(/BEGIN:VEVENT/g)||[]).length,1);});


test('VII semester methodical markers cover the supplied codes and only the requested group',()=>{
 for(const lesson of ['2/31','2/32','2/33','4/27','4/28','16/4','16/5']){
  const e={semester:'winter-2026',company:23,platoon:4,lesson};
  assert.equal(isMethodicalEvent(e),true);
  assert.equal(isMethodicalEvent({...e,company:22}),false);
  assert.equal(isMethodicalEvent({...e,platoon:3}),false);
  assert.equal(isMethodicalEvent({...e,semester:'summer-2026'}),false);
 }
 assert.equal(isMethodicalEvent({semester:'winter-2026',company:23,platoon:4,lesson:'2/24'}),false);
 const actual=filterEvents(data.events,{semester:'winter-2026',company:23,platoon:4});
 assert.equal(actual.filter(isMethodicalEvent).length,7);
 const nov9=actual.find(e=>e.date==='2026-11-09');
 assert.equal(nov9.lesson,'2/32');
 const exported=ics([nov9],data).replace(/\r\n /g,'');
 assert.ok(exported.includes('SUMMARY:WF · '+methodicalLabel+' · '));
 assert.ok(exported.includes('DESCRIPTION:T-2/32. '+methodicalLabel+' · Nie odbyły się. '));
 assert.ok(exported.includes('Trening ogólnousprawniający z wykorzystaniem gier i zabaw terenowych.'));
 assert.ok(!exported.includes('Doskonalenie biegu na orientację.'));
 assert.match(exported,/DTSTART;VALUE=DATE:20261109/);
 const ordinary=actual.find(e=>e.date==='2026-12-11');
 assert.ok(!ics([ordinary],data).includes(methodicalLabel));
});

test('Only November 30 is marked as a methodical makeup session',()=>{
 const group=filterEvents(data.events,{semester:'winter-2026',company:23,platoon:4});
 const makeup=group.find(e=>e.date==='2026-11-30');
 assert.equal(makeup.lesson,'2/24');
 assert.equal(isMakeupEvent(makeup),true);
 assert.equal(isMethodicalEvent(makeup),true);
 assert.deepEqual(group.filter(isMakeupEvent).map(e=>e.date),['2026-11-30']);
 for(const e of group.filter(e=>e.lesson==='2/24'&&e.date!=='2026-11-30'))assert.equal(isMethodicalEvent(e),false);
 assert.equal(isMakeupEvent({...makeup,platoon:3}),false);
 assert.equal(isMakeupEvent({...makeup,company:22}),false);
 assert.equal(isMakeupEvent({...makeup,semester:'summer-2026'}),false);
 assert.equal(isMakeupEvent(group.find(e=>e.date==='2026-11-09')),false);
 const output=ics([makeup],data).replace(/\r\n /g,'');
 assert.ok(output.includes('SUMMARY:WF · '+methodicalLabel+' · odrabianie · '));
 assert.ok(output.includes('DESCRIPTION:T-2/24. '+methodicalLabel+' · odrabianie. '));
 assert.match(output,/DTSTART;VALUE=DATE:20261130/);
 assert.ok(output.includes('Doskonalenie biegu na orientację.'));
 assert.ok(!output.includes('Trening ogólnousprawniający z wykorzystaniem gier i zabaw terenowych.'));
});
