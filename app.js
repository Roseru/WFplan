import {locationButton,setupLocationMap} from './location-map.js';
const closeLocationMap=setupLocationMap();
import {iso,addDays,monday,filterEvents,ics} from './logic.js';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateObj=s=>new Date(s+'T12:00:00');
const format=(s,opts)=>dateObj(s).toLocaleDateString('pl-PL',opts);
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date());
let data,selection,day=today;
try{selection=JSON.parse(localStorage.getItem('wfplan.selection'))||{};}catch{selection={};}
const url=new URL(location.href);
for(const k of ['semester','company','platoon','subgroup'])if(url.searchParams.has(k))selection[k]=url.searchParams.get(k);
if(/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('date')||'')&&!isNaN(dateObj(url.searchParams.get('date'))))day=url.searchParams.get('date');
function options(id,items,value){$(id).innerHTML=items.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('');$(id).value=items.some(x=>String(x.value)===String(value))?value:items[0]?.value||'';return $(id).value;}
function unique(list){return [...new Set(list)].sort((a,b)=>Number(a)-Number(b));}
function choose(resetDate=false){
 selection.semester=$('semester').value;
 const events=data.events.filter(e=>e.semester===selection.semester);
 selection.company=options('company',unique(events.map(e=>e.company)).map(n=>({value:n,label:n+'. kompania'})),selection.company||23);
 selection.platoon=options('platoon',unique(events.filter(e=>e.company==selection.company).map(e=>e.platoon)).map(n=>({value:n,label:n+'. pluton'})),selection.platoon||4);
 const subgroups=[...new Set(events.filter(e=>e.company==selection.company&&e.platoon==selection.platoon).map(e=>e.subgroup).filter(Boolean))].sort();
 selection.subgroup=options('subgroup',[{value:'',label:'Wszystkie podgrupy'},...subgroups.map(n=>({value:n,label:n}))],selection.subgroup);
 $('subgroup-wrap').hidden=!subgroups.length;
 $('company').disabled=$('platoon').disabled=!events.length;
 if(resetDate){const sem=data.semesters.find(x=>x.id===selection.semester);day=today>=sem.start&&today<=sem.end?today:sem.start;}
 render();
}
function selected(){return filterEvents(data.events,selection);}
function title(e){return data.lessons[e.lesson]?.title||(e.lesson?'Opis niedostępny w programie 2024':e.code);}
function place(e){return data.locations[e.location]?.name||'Miejsce nieokreślone';}
function card(e){const lesson=data.lessons[e.lesson],loc=data.locations[e.location];return `<article class="event"><div class="event-top"><span class="code">${esc(e.code)}</span><span class="category">${esc(data.topics[e.topic]||'Wpis w rozkładzie')}</span><span class="block">Blok ${esc(e.block||'—')}</span></div><h3>${esc(title(e))}</h3><div class="event-facts">${locationButton(e.location,place(e))}<span>◷ ${esc(e.instructor||'Brak prowadzącego')}</span>${e.subgroup?`<span>Podgrupa ${esc(e.subgroup)}</span>`:''}</div><details><summary>Temat i szczegóły zajęć</summary><div class="details-body"><dl><dt>Rodzaj zajęć</dt><dd>${esc(lesson?.type||'Brak danych')}</dd><dt>Czas programowy</dt><dd>${lesson?.hours?`${lesson.hours} godz. dydaktyczne łącznie dla punktu programu`:'Brak danych'}</dd><dt>Godzina rozpoczęcia</dt><dd>Nie podano w rozkładzie</dd><dt>Prowadzący</dt><dd>${esc(e.instructor||'Brak danych')} (oznaczenie w rozkładzie)</dd><dt>Grupa / rok studiów</dt><dd>${esc(e.group)} / ${esc(e.year)}</dd><dt>Obiekt</dt><dd>${loc?(loc.outdoor?'Zewnętrzny':'Wewnętrzny'):'Brak danych'}</dd></dl>${!lesson&&e.lesson?'<p class="notice">Ten kod występuje w rozkładzie, ale nie ma go w dostarczonym programie. Potwierdź temat u prowadzącego.</p>':''}<p class="source">Źródło: rozkład WF, arkusz „${esc(e.sheet)}”, komórka ${esc(e.cell)}.${lesson?` Program WF 2024, strona ${lesson.page}, temat ${esc(e.topic)}, zajęcia ${esc(e.lesson.split('/')[1])}.`:''} Miejsce: wytyczne zimowe 2026/27.</p></div></details></article>`;}
function render(){
 closeLocationMap();
 const sem=data.semesters.find(x=>x.id===selection.semester),all=selected(),onDay=all.filter(e=>e.date===day),start=monday(day);
 try{localStorage.setItem('wfplan.selection',JSON.stringify(selection));}catch{}
 const u=new URL(location.href);for(const [k,v] of Object.entries({...selection,date:day}))u.searchParams.set(k,v);history.replaceState(null,'',u);
 $('warning').hidden=!sem.warning;$('warning').textContent=sem.warning;
 $('group-label').textContent=selection.company?`${selection.platoon}. PLUTON / ${selection.company}. KOMPANIA`:'PLAN NIEUDOSTĘPNIONY';
 $('month-label').textContent=format(day,{month:'long',year:'numeric'});
 $('day-label').textContent=format(day,{weekday:'long',day:'numeric',month:'long'});
 $('date').value=day;
 $('day-count').textContent=onDay.length?`${onDay.length} ${onDay.length===1?'wpis':'wpisy'}`:'Brak wpisów';
 $('week').innerHTML=Array.from({length:7},(_,i)=>{const d=addDays(start,i),count=all.filter(e=>e.date===d).length;return `<button class="${d===day?'active':''} ${d===today?'today':''}" data-day="${d}" aria-label="${esc(format(d,{weekday:'long',day:'numeric',month:'long'}))}, ${count} wpisów" aria-pressed="${d===day}"><span>${format(d,{weekday:'short'}).replace('.','')}</span><span class="number">${dateObj(d).getDate()}</span><span class="dots">${'<i class="dot"></i>'.repeat(Math.min(count,3))}</span></button>`;}).join('');
 $('week').querySelectorAll('button').forEach(b=>b.onclick=()=>{day=b.dataset.day;render();});
 const later=all.find(e=>e.date>day);
 $('events').innerHTML=onDay.length?onDay.map(card).join(''):`<div class="empty"><div class="empty-icon">↗</div><h3>${selection.semester==='summer-2027'?'Czekamy na nowy rozkład':'Na ten dzień nie ma wpisów'}</h3>${selection.semester==='summer-2027'?'Przesłany arkusz letni dotyczy poprzedniego roku.':day<sem.start||day>sem.end?'Ta data znajduje się poza zakresem wybranego semestru.':'Wybierz inny dzień lub przejdź do kolejnych zajęć.'}${later?'<br><button id="next-event">Przejdź do kolejnych zajęć →</button>':''}</div>`;
 if($('next-event'))$('next-event').onclick=()=>{day=later.date;render();};
 const upcoming=all.find(e=>e.date>=today);
 $('upcoming').innerHTML=upcoming?`<p class="next-date">${esc(format(upcoming.date,{weekday:'long',day:'numeric',month:'long'}))} · blok ${esc(upcoming.block)}</p><h3>${esc(title(upcoming))}</h3><div class="location">${locationButton(upcoming.location,place(upcoming))}</div><button id="goto-upcoming">Zobacz w planie <span>→</span></button>`:'<h3>Brak kolejnych zajęć</h3><p class="location">W wybranym semestrze nie ma przyszłych wpisów dla tej grupy.</p>';
 if($('goto-upcoming'))$('goto-upcoming').onclick=()=>{day=upcoming.date;render();};
 const outdoors=onDay.some(e=>data.locations[e.location]?.outdoor);
 $('tip-title').textContent=onDay.length?(outdoors?'Zajęcia w terenie':'Zabierz obuwie zmienne'):'Przygotuj się do WF-u';
 $('tip-text').textContent=onDay.length?(outdoors?'Na obiekty zewnętrzne przyjdź już w jednolitym stroju sportowym, dobranym do pogody. Podczas zajęć bez smartfona i słuchawek.':'W miarę możliwości przyjdź przebrany, z obuwiem zmiennym w plecaku. Do budynku SWF wchodzisz z nauczycielem.'):'Wybierz dzień z zajęciami, aby sprawdzić wskazówki dotyczące stroju.';
 $('export').disabled=!all.length;
}
$('semester').onchange=()=>choose(true);
for(const key of ['company','platoon','subgroup'])$(key).onchange=()=>{selection[key]=$(key).value;choose();};
$('prev').onclick=()=>{day=addDays(day,-7);render();};$('next').onclick=()=>{day=addDays(day,7);render();};$('today').onclick=()=>{day=today;render();};$('date').onchange=()=>{if($('date').value){day=$('date').value;render();}};
$('help').onclick=()=>$('info').showModal();$('close-info').onclick=()=>$('info').close();
$('export').onclick=()=>{const blob=new Blob([ics(selected(),data)],{type:'text/calendar;charset=utf-8'});const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=`WF-${selection.company}kp-${selection.platoon}pl-${selection.semester}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);};
try{const response=await fetch('data.json');if(!response.ok)throw Error('Brak pliku danych');data=await response.json();selection.semester=options('semester',data.semesters.map(s=>({value:s.id,label:s.label})),selection.semester||'winter-2026');$('source-list').innerHTML=Object.values(data.sourceFiles).map(n=>`<p>${esc(n)}</p>`).join('');choose();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});}catch(error){$('events').innerHTML='<div class="empty"><h3>Nie udało się wczytać planu</h3>Sprawdź połączenie i odśwież stronę.</div>';console.error(error);}
