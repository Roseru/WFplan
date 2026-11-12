import {defaultSettings,validateSettings,buildSchedule} from './notification-logic.js';

const KEY='wfplan.notifications.v1',esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const units=[{value:1,label:'minut'},{value:60,label:'godzin'},{value:1440,label:'dni'}];
const selectionKey=s=>JSON.stringify([s?.semester,String(s?.company),String(s?.platoon),s?.subgroup||'']);
const groupLabel=s=>s?`${s.platoon}. pluton / ${s.company}. kompania${s.subgroup?' / '+s.subgroup:''}`:'Wybierz grupę w planie';
function read(){try{const raw=JSON.parse(localStorage.getItem(KEY));if(raw){raw.settings=validateSettings(raw.settings);return raw;}}catch{}return {settings:defaultSettings()};}
function base64Bytes(base64){return Uint8Array.from(atob(base64.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
function credentials(state){if(!state.id||!state.token){state.id=crypto.randomUUID();state.token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}}
export function setupNotifications(){
 const dialog=document.getElementById('notification-settings');
 let state=read(),draft,selection,data,config,base,busy=false,syncTimer,syncVersion=0;
 const $=id=>document.getElementById(id),supported='Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window;
 const persist=()=>localStorage.setItem(KEY,JSON.stringify(state));
 const status=(message,error=false)=>{$('notification-status').textContent=/^(Failed to fetch|NetworkError|Load failed)/i.test(message)?'Brak połączenia z usługą powiadomień. Sprawdź internet i spróbuj ponownie.':message;$('notification-status').className=error?'notification-error':'';};
 async function api(path,method,body){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+state.token},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Nie udało się połączyć z usługą powiadomień.');return result;
 }
 const endpoint=()=>'/api/subscriptions/'+state.id;
 async function loadConfig(){
  const response=await fetch('push-config.json',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Powiadomienia są chwilowo niedostępne.');
  const value=await response.json(),url=new URL(value.apiBase);
  if(url.protocol!=='https:')throw Error('Nieprawidłowy adres usługi powiadomień.');base=url.href.replace(/\/$/,'');
  const res=await fetch(base+'/api/config',{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('Nie udało się połączyć z usługą powiadomień.');config=await res.json();
  if(!config.ready)throw Error('Powiadomienia są chwilowo niedostępne.');return config;
 }
 function preview(){
  try{draft=collect();const job=data&&selection?buildSchedule(data,selection,{...draft,enabled:true})[0]:null;
   $('notification-preview').innerHTML=job?`<small>PRZYKŁAD NAJBLIŻSZEGO PRZYPOMNIENIA</small><strong>${esc(job.payload.title)}</strong><span>${esc(job.payload.body).replace(/\n/g,'<br>')}</span>`:'Brak przyszłych przypomnień przy tych ustawieniach.';
  }catch{$('notification-preview').textContent='Uzupełnij wyprzedzenia, aby zobaczyć podgląd.';}
 }
 function row(r,kind,index){const unit=r.minutes%1440===0?1440:r.minutes%60===0?60:1;return `<div class="reminder-row"><label class="reminder-check"><input type="checkbox" data-enabled ${r.enabled?'checked':''} aria-label="Włącz przypomnienie ${index+1}"></label><label class="sr-only" for="${kind}-${index}-value">Wyprzedzenie przypomnienia ${index+1}</label><input id="${kind}-${index}-value" data-value type="number" min="1" max="43200" step="1" value="${r.minutes/unit}" inputmode="numeric"><label class="sr-only" for="${kind}-${index}-unit">Jednostka przypomnienia ${index+1}</label><select id="${kind}-${index}-unit" data-unit>${units.map(u=>`<option value="${u.value}" ${u.value===unit?'selected':''}>${u.label}</option>`).join('')}</select><span>przed</span><button type="button" class="remove-reminder" aria-label="Usuń przypomnienie ${index+1}">×</button></div>`;}
 function renderGroup(kind){const group=draft[kind];$('notification-'+kind+'-enabled').checked=group.enabled;$('reminders-'+kind).innerHTML=group.reminders.map((r,i)=>row(r,kind,i)).join('');
  $('reminders-'+kind).querySelectorAll('.remove-reminder').forEach(b=>b.onclick=()=>{b.parentElement.remove();preview();});
 }
 function collect(){const result={enabled:$('notifications-enabled').checked};
  for(const kind of ['wf','methodical'])result[kind]={enabled:$('notification-'+kind+'-enabled').checked,reminders:[...$('reminders-'+kind).children].map(row=>({enabled:row.querySelector('[data-enabled]').checked,minutes:Number(row.querySelector('[data-value]').value)*Number(row.querySelector('[data-unit]').value)}))};
  return validateSettings(result);
 }
 function render(){draft=structuredClone(state.settings);$('notifications-enabled').checked=draft.enabled;for(const kind of ['wf','methodical'])renderGroup(kind);$('notification-group').textContent=groupLabel(selection);$('notification-test').disabled=!state.settings.enabled||busy;preview();}
 async function registration(){await navigator.serviceWorker.register('sw.js');return navigator.serviceWorker.ready;}
 async function sync(settings,target){
  if(!config?.ready)await loadConfig();credentials(state);persist();
  const reg=await registration();let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64Bytes(config.publicKey)});
  const result=await api(endpoint(),'PUT',{subscription:sub.toJSON(),selection:target,settings});
  state.syncedSelection={...target};return result;
 }
 async function disable(){
  if(state.id&&state.token){if(!config?.ready)await loadConfig();await api(endpoint(),'DELETE');}
  if(supported){const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager.getSubscription();if(sub)await sub.unsubscribe();}
  delete state.syncedSelection;
 }
 $('notification-open').onclick=async()=>{
  render();dialog.showModal();dialog.scrollTop=0;$('notifications-enabled').disabled=true;$('notification-test').disabled=true;
  if(!supported){status('Ta przeglądarka nie obsługuje push. Na iPhonie otwórz WFplan dodany do ekranu początkowego (iOS 16.4 lub nowszy).',true);return;}
  status('Sprawdzanie powiadomień…');
  try{await loadConfig();$('notifications-enabled').disabled=false;$('notification-test').disabled=!state.settings.enabled;
   if(Notification.permission==='denied')status('Powiadomienia są zablokowane w ustawieniach przeglądarki. Zmień uprawnienia witryny, aby je włączyć.',true);
   else status(state.settings.enabled?`Powiadomienia włączone: ${groupLabel(state.syncedSelection)}.`:'Powiadomienia są wyłączone. Ustaw wyprzedzenia i zapisz.');
  }catch(e){status(e.message,true);}
 };
 $('notification-close').onclick=()=>{if(!busy)dialog.close();};
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 $('notifications-enabled').onchange=async()=>{
  if($('notifications-enabled').checked&&supported&&Notification.permission!=='granted'){
   // Request directly from this user gesture, never on page load or in a timer.
   const permission=await Notification.requestPermission();if(permission!=='granted'){$('notifications-enabled').checked=false;status('Zgoda na powiadomienia nie została udzielona. Możesz nadal zapisać wyprzedzenia.',true);return;}
  }preview();
 };
 for(const kind of ['wf','methodical'])$('add-'+kind+'-reminder').onclick=()=>{try{draft=collect();if(draft[kind].reminders.length>=12)throw Error('Możesz dodać do 12 przypomnień.');let value=30;while(draft[kind].reminders.some(r=>r.minutes===value))value+=30;draft[kind].reminders.push({minutes:value,enabled:true});renderGroup(kind);preview();}catch(e){status(e.message,true);}};
 dialog.addEventListener('input',e=>{if(e.target.closest('.notification-group'))preview();});
 $('notification-defaults').onclick=()=>{const enabled=$('notifications-enabled').checked;draft=defaultSettings();draft.enabled=enabled;for(const kind of ['wf','methodical'])renderGroup(kind);preview();status('Przywrócono domyślne wyprzedzenia. Zapisz, aby zastosować.');};
 $('notification-form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  try{const settings=collect();if(settings.enabled&&(!supported||Notification.permission!=='granted'))throw Error('Najpierw zezwól na powiadomienia w przeglądarce.');
   busy=true;$('notification-save').disabled=true;$('notification-close').disabled=true;status('Zapisywanie…');
   // Serialize with automatic group sync so an older request cannot overwrite this save.
   clearTimeout(syncTimer);syncVersion++;
   await pendingSync.catch(()=>{});
   const result=settings.enabled?await sync(settings,{...selection}):await disable();
   state.settings=settings;persist();$('notification-test').disabled=!settings.enabled;
   status(settings.enabled?`Zapisano dla: ${groupLabel(state.syncedSelection)}. Zaplanowane przypomnienia: ${result.scheduled}.`:'Zapisano. Powiadomienia są wyłączone.');
  }catch(error){status(error.message||'Nie udało się zapisać ustawień.',true);}
  finally{busy=false;$('notification-save').disabled=false;$('notification-close').disabled=false;}
 };
 $('notification-test').onclick=async()=>{if(busy)return;try{busy=true;$('notification-test').disabled=true;status('Wysyłanie powiadomienia testowego…');await api(endpoint()+'/test','POST');status('Test został wysłany. Sprawdź powiadomienia urządzenia.');}catch(e){status(e.message,true);}finally{busy=false;$('notification-test').disabled=!state.settings.enabled;}};
 let pendingSync=Promise.resolve();
 function updateSelection(next,source){
  const changed=selectionKey(selection)!==selectionKey(next);selection={...next};data=source;if(dialog.open){$('notification-group').textContent=groupLabel(selection);preview();}
  if(!changed||!state.settings.enabled||!supported||Notification.permission!=='granted')return;
  clearTimeout(syncTimer);const version=++syncVersion;
  syncTimer=setTimeout(()=>{pendingSync=pendingSync.catch(()=>{}).then(async()=>{if(version!==syncVersion||busy)return;try{const target={...selection};await sync(state.settings,target);persist();if(dialog.open)status(`Powiadomienia dla: ${groupLabel(target)}.`);}catch(e){if(dialog.open)status(`Nie zaktualizowano grupy. Nadal: ${groupLabel(state.syncedSelection)}. ${e.message}`,true);}});},500);
 }
 return {updateSelection};
}
