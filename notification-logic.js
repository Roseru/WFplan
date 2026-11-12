import {filterEvents,isMethodicalEvent,isMakeupEvent,isReplacedEvent,makeupTitle,replacementTitle} from './logic.js';

export const BLOCK_STARTS={1:'08:00',3:'09:50',5:'11:40',7:'13:30'};
export const PLACE_LABELS={T:'TEREN',B:'BALON',B1:'BALON',B2:'BALON',B3:'BALON',H:'SWF',M:'SWF',U:'SWF',S:'SWF',G:'SWF',J:'SWF','Ż':'DRĄŻKI',P:'BASEN',L:'LTP',O:'OSF',N:'PIŁKA',K:'KOSZYKÓWKA',C:'BTS/BTZ',D:'ARCHIMEDES',A:'STADION',X:'AW4',F:'SIATKÓWKA',E:'SIŁOWNIA AW3'};
export const defaultSettings=()=>({enabled:false,wf:{enabled:true,reminders:[{minutes:1440,enabled:true},{minutes:60,enabled:true}]},methodical:{enabled:true,reminders:[{minutes:10080,enabled:true},{minutes:2880,enabled:true},{minutes:1440,enabled:true},{minutes:60,enabled:true}]}});
export function validateSettings(input){
 if(!input||typeof input.enabled!=='boolean')throw Error('Nieprawidłowe ustawienia powiadomień.');
 const out={enabled:input.enabled};
 for(const kind of ['wf','methodical']){
  const group=input[kind];if(!group||typeof group.enabled!=='boolean'||!Array.isArray(group.reminders)||group.reminders.length>12)throw Error('Możesz ustawić do 12 przypomnień dla każdego rodzaju zajęć.');
  const used=new Set();out[kind]={enabled:group.enabled,reminders:group.reminders.map(r=>{
   if(!Number.isInteger(r.minutes)||r.minutes<1||r.minutes>43200||typeof r.enabled!=='boolean')throw Error('Wyprzedzenie musi wynosić od 1 minuty do 30 dni.');
   if(used.has(r.minutes))throw Error('To samo wyprzedzenie występuje dwa razy.');used.add(r.minutes);return {minutes:r.minutes,enabled:r.enabled};
  })};
 }return out;
}
export const blockStart=e=>BLOCK_STARTS[parseInt(e.block)]||null;
const warsaw=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
// Convert civil Warsaw time to an instant, including CET/CEST transitions.
export function eventStart(e){
 const time=blockStart(e);if(!time)return null;
 const civil=Date.parse(e.date+'T'+time+':00Z');if(!Number.isFinite(civil))return null;
 let result=civil;for(let i=0;i<3;i++){const p=Object.fromEntries(warsaw.formatToParts(result).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));const represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);result+=civil-represented;}return result;
}
export function eventKind(e,data){return !isReplacedEvent(e)&&(isMethodicalEvent(e)||data.lessons[e.lesson]?.type==='instruktorsko-metodyczne')?'methodical':'wf';}
export function actualTitle(e,data){return isMakeupEvent(e)?makeupTitle:isReplacedEvent(e)?replacementTitle:data.lessons[e.lesson]?.title||e.code;}
export function notificationPlace(e,data){
 const place=PLACE_LABELS[e.location]||data.locations[e.location]?.name||'MIEJSCE NIEPODANE';
 const uniform=String(e.topic)==='4'||/walk[aię]\s+wręcz/i.test(actualTitle(e,data));
 return place+(e.location==='P'?'':uniform?' (MUNDUR)':data.locations[e.location]?.outdoor===false?' (CZYSTE OBUWIE)':'');
}
const plural=(n,one,few,many)=>n===1?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;
export function leadText(minutes){
 if(minutes===60)return 'za godzinę';if(minutes===1440)return 'za dzień';
 if(minutes%1440===0)return `za ${minutes/1440} dni`;
 if(minutes%60===0){const n=minutes/60;return `za ${n} ${plural(n,'godzinę','godziny','godzin')}`;}
 return `za ${minutes} ${plural(minutes,'minutę','minuty','minut')}`;
}
export function notificationPayload(e,data,minutes,origin='https://wfplan-wat.github.io'){
 const kind=eventKind(e,data),url=new URL('/',origin);
 for(const key of ['semester','company','platoon','subgroup','date'])url.searchParams.set(key,e[key]??'');
 return {title:`${kind==='methodical'?'METODYKA':'WF'} ${leadText(minutes)} — ${notificationPlace(e,data)}`,body:`${actualTitle(e,data)}\n${e.date.split('-').reverse().join('.')} · ${blockStart(e)} · ${e.platoon}. pluton / ${e.company}. kompania`,url:url.href,tag:`wf-${e.semester}-${e.sheet}-${e.cell}-${minutes}`};
}
export function buildSchedule(data,selection,settings,now=Date.now()){
 settings=validateSettings(settings);if(!settings.enabled)return [];
 const jobs=[],seen=new Set();
 for(const e of filterEvents(data.events,selection)){
  const starts=eventStart(e);if(starts===null||starts<=now)continue;
  const kind=eventKind(e,data),group=settings[kind];if(!group.enabled)continue;
  for(const r of group.reminders){
   const due=starts-r.minutes*60000;if(!r.enabled||due<=now)continue;
   // Shared entries and subgroup duplicates must not produce duplicate notifications.
   const key=[e.semester,e.date,e.block,e.lesson,e.location,r.minutes].join('|');if(seen.has(key))continue;seen.add(key);
   jobs.push({key,due,starts,payload:notificationPayload(e,data,r.minutes)});
  }
 }return jobs.sort((a,b)=>a.due-b.due);
}
