export const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function addDays(day,n){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return iso(d);}
export function monday(day){const d=new Date(day+'T12:00:00');return addDays(day,-((d.getDay()+6)%7));}
export function filterEvents(events,s){return events.filter(e=>e.semester===s.semester&&e.company==s.company&&e.platoon==s.platoon&&(!s.subgroup||!e.subgroup||e.subgroup===s.subgroup)).sort((a,b)=>a.date.localeCompare(b.date)||parseInt(a.block)-parseInt(b.block)||a.cell.localeCompare(b.cell));}
// VII semestr, zima 2026/2027: zielone tematy z zestawienia użytkownika.
const methodicalLessons=new Set(['2/31','2/32','2/33','4/27','4/28','16/4','16/5']);
const isTargetCompany=e=>e.semester==='winter-2026'&&Number(e.company)===23&&[1,2,3,4].includes(Number(e.platoon));
const isTargetGroup=e=>isTargetCompany(e)&&Number(e.platoon)===4;
export function isReplacedEvent(e){return isTargetGroup(e)&&e.date==='2026-11-09'&&e.lesson==='2/32';}
export const replacementTitle='Trening ogólnousprawniający z wykorzystaniem gier i zabaw terenowych.';
export function isMakeupEvent(e){return isTargetGroup(e)&&e.date==='2026-11-30'&&e.lesson==='2/24';}
export function isMethodicalEvent(e){return isTargetCompany(e)&&(methodicalLessons.has(e.lesson)||isMakeupEvent(e));}
export const makeupTitle='Doskonalenie biegu na orientację.';
export const methodicalLabel='Zajęcia instruktorsko-metodyczne';
export const methodicalEventLabel=e=>methodicalLabel+(isMakeupEvent(e)?' · odrabianie':isReplacedEvent(e)?' · Nie odbyły się':'');
const escapeICS=s=>String(s??'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line){let result='',part='',bytes=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(bytes+size>73){result+=part+'\r\n ';part='';bytes=1;}part+=ch;bytes+=size;}return result+part;}
export function ics(events,data){const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//WFplan//WAT//PL','CALSCALE:GREGORIAN','X-WR-CALNAME:Plan WF WAT'];for(const e of events){const lesson=data.lessons[e.lesson];rows.push('BEGIN:VEVENT',`UID:${e.semester}-${e.cell}-${e.company}-${e.platoon}@wfplan`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z')}`,`DTSTART;VALUE=DATE:${e.date.replaceAll('-','')}`,`DTEND;VALUE=DATE:${addDays(e.date,1).replaceAll('-','')}`,`SUMMARY:${escapeICS('WF · '+(isMethodicalEvent(e)?methodicalEventLabel(e)+' · ':'')+(isMakeupEvent(e)?makeupTitle:isReplacedEvent(e)?replacementTitle:lesson?.title||e.code))}`,`LOCATION:${escapeICS(data.locations[e.location]?.name||'Nie podano')}`,`DESCRIPTION:${escapeICS(`${e.code}. ${isMethodicalEvent(e)?methodicalEventLabel(e)+'. ':''}Blok ${e.block}. Godzina rozpoczęcia niepodana; wpis całodniowy. Prowadzący: ${e.instructor}. Grupa: ${e.group}. Źródło: ${e.sheet}!${e.cell}.`)}`,'TRANSP:TRANSPARENT','END:VEVENT');}rows.push('END:VCALENDAR');return rows.map(fold).join('\r\n')+'\r\n';}
