// Coordinates in the 625 × 634 user-supplied SWF assembly-point diagram.
// Shared labels deliberately share a marker; the source does not distinguish them.
export const MAP_POINTS = {
  O: {x:198,y:247,rx:9,ry:18,group:'O'},
  B: {x:244,y:274,rx:26,ry:8,group:'B1, B2, B3'},
  L: {x:277,y:254,rx:9,ry:15,group:'L'},
  Ż: {x:281,y:300,rx:8,ry:16,group:'Ż'},
  A: {x:307,y:314,rx:13,ry:8,group:'A'},
  T: {x:260,y:330,rx:37,ry:9,group:'T'},
  C: {x:210,y:346,rx:15,ry:6,group:'C'},
  N: {x:291,y:376,rx:9,ry:29,group:'N, D'},
  K: {x:294,y:429,rx:17,ry:8,group:'K, F'},
  H: {x:371,y:414,rx:11,ry:18,group:'H, M, U'},
  S: {x:365,y:446,rx:42,ry:10,group:'S, G, J'},
  E: {x:264,y:465,rx:12,ry:7,group:'E'},
  P: {x:416,y:490,rx:17,ry:8,group:'P, X'},
};
for (const [code,base] of Object.entries({B1:'B',B2:'B',B3:'B',D:'N',F:'K',M:'H',U:'H',G:'S',J:'S',X:'P'})) MAP_POINTS[code]=MAP_POINTS[base];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function locationButton(code,name){
  return MAP_POINTS[code]?`<button type="button" class="location-button" data-location="${escape(code)}" data-place="${escape(name)}" aria-haspopup="dialog" aria-expanded="false" aria-controls="location-map" aria-label="${escape(name)} — pokaż na mapie">⌖ <span>${escape(name)}</span><span class="map-hint" aria-hidden="true">↗</span></button>`:`<span>⌖ ${escape(name)}</span>`;
}
export function setupLocationMap(){
  const panel=document.createElement('section');
  panel.id='location-map';panel.className='map-popover';panel.hidden=true;
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','map-title');
  document.body.append(panel);
  let active=null,pinned=false,timer;
  function position(){
    if(!active||!active.isConnected){hide();return;}
    const rect=active.getBoundingClientRect(),width=panel.offsetWidth,height=panel.offsetHeight,gap=10;
    const left=Math.max(gap,Math.min(rect.left,innerWidth-width-gap));
    let top=rect.bottom+gap;
    if(top+height>innerHeight-gap)top=rect.top-height-gap;
    panel.style.left=left+'px';panel.style.top=Math.max(gap,Math.min(top,innerHeight-height-gap))+'px';
  }
  function hide(){clearTimeout(timer);active?.setAttribute('aria-expanded','false');panel.hidden=true;active=null;pinned=false;}
  function show(button,pin=false){
    clearTimeout(timer);
    if(pinned&&!pin&&active!==button)return;
    const point=MAP_POINTS[button.dataset.location];if(!point)return;
    active?.setAttribute('aria-expanded','false');active=button;pinned=pin||pinned;
    active.setAttribute('aria-expanded','true');
    panel.innerHTML=`<div class="map-heading"><div><p class="eyebrow">MAPA SWF WAT · ${escape(button.dataset.location)}</p><h3 id="map-title">${escape(button.dataset.place)}</h3></div><button class="map-close" type="button" aria-label="Zamknij mapę">×</button></div><svg class="campus-map" viewBox="0 0 625 634" role="img" aria-label="Zielone zaznaczenie: punkt ${escape(point.group)} na schemacie SWF"><image href="campus-map.png" width="625" height="634"/><ellipse cx="${point.x}" cy="${point.y}" rx="${point.rx+7}" ry="${point.ry+7}" fill="#22c55e" fill-opacity=".25" stroke="white" stroke-width="7"/><ellipse cx="${point.x}" cy="${point.y}" rx="${point.rx+7}" ry="${point.ry+7}" fill="#22c55e" fill-opacity=".3" stroke="#008d39" stroke-width="5"/></svg><p class="map-caption"><span class="map-green-dot"></span> Zielone zaznaczenie: ${escape(point.group)}</p><p class="map-source">Punkt wskazany na przesłanym schemacie miejsc zbiórek.${point.group.includes(',')?' Schemat łączy te oznaczenia w jednym miejscu.':''}</p>`;
    panel.hidden=false;position();
    panel.querySelector('.map-close').onclick=()=>{const button=active;hide();button?.focus({preventScroll:true});hide();};
  }
  function scheduleHide(){clearTimeout(timer);if(!pinned)timer=setTimeout(hide,180);}
  document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const button=e.target.closest('.location-button');if(button)show(button);else if(panel.contains(e.target))clearTimeout(timer);});
  document.addEventListener('pointerout',e=>{if(e.pointerType==='touch')return;if(e.target.closest('.location-button')||panel.contains(e.target)){if(active?.contains(e.relatedTarget)||panel.contains(e.relatedTarget))return;scheduleHide();}});
  document.addEventListener('focusin',e=>{const button=e.target.closest('.location-button');if(button)show(button);else if(!panel.contains(e.target)&&!pinned)hide();});
  document.addEventListener('click',e=>{const button=e.target.closest('.location-button');if(button){if(active===button&&pinned)hide();else show(button,true);}else if(!panel.contains(e.target))hide();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();hide();}});
  window.addEventListener('resize',()=>{if(!panel.hidden)position();});
  window.addEventListener('scroll',()=>{if(!panel.hidden)position();},true);
  return hide;
}
