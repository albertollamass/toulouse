/* app.js: adaptador driver (presentación).
   Solo habla con el DOM y con los casos de uso (TripApp). No toca
   localStorage de gastos/lugares ni Firebase directamente.
   El CRUD simple y local (perfil, planning, vuelos, checklist) se queda
   aquí tal cual: no justifica capas propias. */
const PEOPLE = ["Juan","Monzón","Isidro","Morillo","Alberto","Paco"];
const LS = { who:"tls_whoami", flights:"tls_flights", exp:"tls_expenses", done:"tls_done", checklist:"tls_check", places:"tls_places" };
const $ = s => document.querySelector(s);

function setCloudStatus(txt){
  ["#exp-cloud","#map-cloud"].forEach(s=>{ const el=document.querySelector(s); if(el) el.textContent = txt; });
}
let App = null;

// ---------- Perfil: quién eres ----------
function loadWho(){ return localStorage.getItem(LS.who) || ""; }
function renderProfileGrid(){
  const g = $("#profile-grid"); g.innerHTML = "";
  PEOPLE.forEach(p=>{
    const b = document.createElement("button");
    b.textContent = (p==="Paco"?"🧑‍🏠 ":"🙋 ") + p;
    b.onclick = ()=>{ localStorage.setItem(LS.who,p); updateWho(); $("#profile-modal").classList.add("hidden"); };
    g.appendChild(b);
  });
}
function updateWho(){
  const w = loadWho();
  $("#whoami-label").textContent = w || "nadie aún";
}
$("#whoami-btn").onclick = ()=>{ renderProfileGrid(); $("#profile-modal").classList.remove("hidden"); };

// ---------- Tabs ----------
function refreshFromCloud(silent){
  if(!App || !App.cloud) return;
  App.refresh(silent).then(()=>{ renderExpenses(); renderPlaces(); });
}
function showTab(name){
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active", x.dataset.tab===name));
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active", x.id==="tab-"+name));
  if(name==="mapa" && typeof map!=="undefined" && map) setTimeout(()=>{ try{map.invalidateSize();}catch(e){} },200);
  document.querySelector("main").scrollIntoView({behavior:"smooth", block:"start"});
  if(name==="gastos"||name==="mapa") refreshFromCloud(true);
}
document.querySelectorAll(".tabs button").forEach(b=>{
  b.onclick = ()=> showTab(b.dataset.tab);
});

// ---------- Planning ----------
const PLAN = [
 {d:"Jue 1 oct: llegadas", cls:"", items:[
  ["vue","✈️ 11:00 Team Sevilla aterriza en TLS → tram al apartamento, check-in 18 Rue de Cugnaux"],
  ["tap","🥐 Team Sevilla: brunch en Victor Hugo market + siesta estratégica"],
  ["tur","🚶 15:30 Todos los que estén: paseo St-Cyprien → Pont Neuf → Place du Capitole (primer contacto)"],
  ["vue","✈️ 20:15 Team Madrid aterriza → recogida + cena de bienvenida todos juntos"],
  ["tap","🍷 21:30 Cena bienvenida con Paco: Chez Emile o Le Colombier (cassoulet) + Place Saint-Pierre tranqui"],
 ]},
 {d:"Vie 2 oct: Toulouse clásico", cls:"", items:[
  ["tur","🏛 10:00 Capitole (sala de los Ilustres gratis) + Donjon"],
  ["tur","⛪ 11:30 Basilique Saint-Sernin + Couvent des Jacobins (el palmier más bonito)"],
  ["tap","🍽 13:30 Almuerzo: Marché Victor Hugo (planta alta, menú + vino)"],
  ["tur","🌳 16:00 Jardin Japonais + Canal du Midi en bici/paseo"],
  ["tap","🍷 19:30 Apéro en la Garonne: Quai de la Daurade, vino + tabla"],
  ["fie","🌙 22:30 Noche Saint-Pierre: bares (Delirium, Casa) → club L'Opium o Le Purple"],
 ]},
 {d:"Sáb 3 oct: día grande y noche grande", cls:"sat", items:[
  ["tur","🚀 10:00 Cité de l'Espace (medio día, imprescindible) o alternativa Airbus tour Blagnac"],
  ["tap","🥘 14:00 Comida tardía: La Saucisse / Le Magret"],
  ["tur","🛍 16:30 Carmes + Rue Alsace-Lorraine + fotos Pont Saint-Pierre al atardecer"],
  ["fie","🍹 20:00 Previa en casa de Paco (Av. de Lombez), calimocho diplomático"],
  ["fie","🌙 23:00 SÁBADO FIESTA: Rue Gabriel Péri → La Couleur de la Culotte → cerrar donde diga Paco"],
 ]},
 {d:"Dom 4 oct: resaca junto al Garona", cls:"sun", items:[
  ["tap","🥞 11:00 Brunch resaca: Le Pelon o Café Cerise"],
  ["tur","🚲 13:00 Canal du Midi + Port de l'Embouchure + Jardín des Plantes (plan tranqui)"],
  ["tur","⛪ 17:00 Cathédrale Saint-Étienne + Quartier Carmes, compras souvenirs"],
  ["tap","🌅 19:30 Atardecer Pont Neuf + cena despedida: Le Genty Magre (pato)"],
  ["fie","🌙 Última copa tranqui en Saint-Pierre (mañana madrugan los de Sevilla)"],
 ]},
 {d:"Lun 5 oct: vueltas", cls:"", items:[
  ["vue","✈️ 4:30 Team Sevilla: taxi al aeropuerto → vuelo 6:25 → Sevilla 8:10"],
  ["tap","🥐 9:00 Team Madrid: desayuno + limpiar apartamento 18 Rue de Cugnaux"],
  ["vue","✈️ 10:45 Team Madrid vuela → llega 12:15 a Madrid"],
  ["tur","👋 Paco vuelve a la normalidad en Av. de Lombez. ¡Gracias Paco!"],
 ]},
];
function loadDone(){ try{return JSON.parse(localStorage.getItem(LS.done)||"{}")}catch{return{}} }
function renderPlan(){
  const done = loadDone(), box = $("#itinerary"); box.innerHTML="";
  PLAN.forEach((day,di)=>{
    const d = document.createElement("div"); d.className="day "+day.cls;
    d.innerHTML = `<h3>${day.d}</h3>`;
    const ul = document.createElement("ul");
    day.items.forEach((it,ii)=>{
      const li = document.createElement("li");
      const key = di+"-"+ii;
      if(done[key]) li.classList.add("done");
      const tag = it[0]==="tur"?'<span class="tag tur">turismo</span>':it[0]==="tap"?'<span class="tag tap">tapeo</span>':it[0]==="fie"?'<span class="tag fie">fiesta</span>':'<span class="tag vue">vuelos</span>';
      li.innerHTML = tag + it[1];
      li.onclick = ()=>{ const dd=loadDone(); dd[key]=!dd[key]; localStorage.setItem(LS.done,JSON.stringify(dd)); renderPlan(); };
      ul.appendChild(li);
    });
    d.appendChild(ul); box.appendChild(d);
  });
}

// ---------- Vuelos ----------
function loadFlights(){ try{return JSON.parse(localStorage.getItem(LS.flights)||'{"Juan":"Sevilla","Monzón":"Sevilla","Isidro":"Madrid","Morillo":"Madrid","Alberto":"Sevilla","Paco":"-"}')}catch{return{}} }
function renderFlights(){
  const f = loadFlights(), box = $("#flight-assign"); box.innerHTML="";
  PEOPLE.forEach(p=>{
    const row = document.createElement("div"); row.className="frow";
    row.innerHTML = `<span class="nm">${p==="Paco"?"🧑‍🏠":""}${p}</span>`;
    const seg = document.createElement("div"); seg.className="seg";
    ["Sevilla","Madrid","-"].forEach(opt=>{
      const b=document.createElement("button");
      b.textContent = opt==="-"?"Ya está allí":opt;
      if(f[p]===opt) b.className = opt==="Sevilla"?"on-s":opt==="Madrid"?"on-m":"on-s";
      if(opt==="-") b.style.opacity=.7;
      b.onclick=()=>{ const ff=loadFlights(); ff[p]=opt; localStorage.setItem(LS.flights,JSON.stringify(ff)); renderFlights(); };
      seg.appendChild(b);
    });
    row.appendChild(seg); box.appendChild(row);
  });
  const vals = Object.values(f);
  const s = vals.filter(v=>v==="Sevilla").length, m = vals.filter(v=>v==="Madrid").length;
  $("#flight-summary").innerHTML = `🟠 Sevilla: <b>${s}</b> (ida 9:15-11:00, vuelta 6:25-8:10)<br>🔵 Madrid: <b>${m}</b> (ida 18:55-20:15, vuelta 10:45-12:15)`;
}

// ---------- Gastos estilo Tricount ----------
function renderExpenseForm(){
  const w = loadWho();
  $("#exp-payer").innerHTML = PEOPLE.map(p=>`<option ${p===w?"selected":""}>${p}</option>`).join("");
  const box = $("#exp-participants"); box.innerHTML="";
  PEOPLE.forEach(p=>{
    const l=document.createElement("label");
    l.innerHTML=`<input type="checkbox" checked value="${p}" style="width:auto"> ${p}`;
    box.appendChild(l);
  });
}
$("#exp-all").onclick = ()=>{ document.querySelectorAll("#exp-participants input").forEach(c=>c.checked=true); };
$("#expense-form").onsubmit = e=>{
  e.preventDefault();
  const parts=[...document.querySelectorAll("#exp-participants input:checked")].map(c=>c.value);
  try{
    App.expenses.add({
      title: $("#exp-title").value.trim(),
      amountEuros: parseFloat($("#exp-amount").value),
      payer: $("#exp-payer").value,
      parts: parts,
      by: loadWho()||$("#exp-payer").value,
      date: new Date().toLocaleDateString("es-ES")
    });
  }catch(err){ alert("Falta concepto, importe o participantes"); return; }
  $("#exp-title").value=""; $("#exp-amount").value=""; renderExpenses();
};
$("#exp-clear").onclick = ()=>{
  if(!confirm("¿Borrar todos los gastos?")) return;
  App.expenses.clear(); renderExpenses();
};

function renderExpenses(){
  const D = window.TripDomain;
  const arr = App.expenses.list(), bal = D.computeBalances(arr, PEOPLE);
  $("#balances").innerHTML = PEOPLE.map(p=>{
    const v=(bal[p]||0);
    return `<div class="bal">${p}<b class="${v>=0?"pos":"neg"}">${v>=0?"+":""}${D.formatEUR(v)}</b><small>${v>=0?"le deben":"debe"}</small></div>`;
  }).join("");
  const s=D.simplifyDebts(bal);
  $("#settlements").innerHTML = s.length
    ? "<b>Para saldar:</b><br>"+s.map(t=>`${t.from} → ${t.to}: <b>${D.formatEUR(t.cents)}</b>`).join("<br>")
    : "Sin deudas. Añade el primer gasto 🍷";
  $("#expense-list").innerHTML = arr.length? "" : "<p class='hint'>Sin gastos todavía.</p>";
  arr.forEach((g)=>{
    const d=document.createElement("div"); d.className="exp";
    d.innerHTML=`<div><b>${g.title}</b> ${Number(g.amount).toFixed(2)}€<br><small>Pagó ${g.payer}, entre ${g.parts.join(", ")}, ${g.date}</small></div>`;
    const del=document.createElement("button"); del.className="del"; del.textContent="🗑";
    del.onclick=()=>{ App.expenses.remove(g.key); renderExpenses(); };
    d.appendChild(del); $("#expense-list").appendChild(d);
  });
}

// ---------- Mapa ----------
const BASE_PLACES = [
 {n:"🏠 Apartamento, 18 Rue de Cugnaux", c:"casa", lat:43.5965, lng:1.4306, d:"Base del grupo. Metro A St-Cyprien."},
 {n:"🧑‍🏠 Casa de Paco, 64 Av. de Lombez", c:"casa", lat:43.5903, lng:1.4065, d:"Anfitrión. Previa del sábado aquí."},
 {n:"✈️ Aeropuerto TLS Blagnac", c:"extra", lat:43.6291, lng:1.3638, d:"Llegadas 11:00 y 20:15 · salidas 6:25 y 10:45."},
 {n:"🏛 Place du Capitole", c:"turismo", lat:43.6045, lng:1.4442, d:"Km 0. Sala de los Ilustres gratis."},
 {n:"⛪ Basilique Saint-Sernin", c:"turismo", lat:43.6084, lng:1.4422, d:"Románico UNESCO."},
 {n:"⛪ Couvent des Jacobins", c:"turismo", lat:43.6027, lng:1.4393, d:"El palmier gótico. Muy fotogénico."},
 {n:"🌉 Pont Neuf + Quai de la Daurade", c:"turismo", lat:43.6005, lng:1.4350, d:"Atardecer + apéro en el río."},
 {n:"🌙 Place Saint-Pierre (fiesta)", c:"fiesta", lat:43.6018, lng:1.4358, d:"Bares pegados: Delirium, Casa, Saint-Pierre."},
 {n:"🌙 Rue Gabriel Péri (fiesta)", c:"fiesta", lat:43.6050, lng:1.4405, d:"Eje de marcha + clubs: Opium, Purple."},
 {n:"🚀 Cité de l'Espace", c:"turismo", lat:43.5867, lng:1.4959, d:"Medio día del sábado."},
 {n:"🌳 Jardin Japonais", c:"turismo", lat:43.6115, lng:1.4338, d:"Plan tranqui viernes."},
 {n:"🚲 Canal du Midi", c:"turismo", lat:43.6110, lng:1.4340, d:"Bici/paseo domingo resaca."},
 {n:"🍽 Marché Victor Hugo", c:"extra", lat:43.6055, lng:1.4465, d:"Comer arriba el viernes."},
];
let map, markers=[];
function placeRowButtons(d, p, extra){
  (extra||[]).forEach(b=>d.appendChild(b));
  if(p.key){
    const q=document.createElement("button"); q.className="btn danger small"; q.textContent="Quitar";
    q.onclick=()=>{ App.places.remove(p.key); renderPlaces(); };
    d.appendChild(q);
  }
}
function initMap(){
  if(typeof L==="undefined"){ $("#map").innerHTML="<p class='hint'>No se pudo cargar el mapa (se necesita internet para Leaflet/OpenStreetMap). Los lugares siguen listados abajo 👇</p>"; renderPlacesNoMap(); return; }
  map = L.map("map").setView([43.6005,1.44],12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);
  renderPlaces();
  map.on("contextmenu",e=>{ $("#pl-lat").value=e.latlng.lat.toFixed(4); $("#pl-lng").value=e.latlng.lng.toFixed(4); alert("Coordenadas copiadas al formulario ✅"); });
}
function renderPlaces(){
  if(typeof L==="undefined" || !map){ renderPlacesNoMap(); return; }
  markers.forEach(m=>map.removeLayer(m)); markers=[];
  const f=$("#place-filter").value, custom=App.places.list();
  const all=[...BASE_PLACES, ...custom];
  const box=$("#place-list"); box.innerHTML="";
  all.filter(p=>f==="all"||p.c===f).forEach((p,i)=>{
    const mk=L.marker([p.lat,p.lng]).addTo(map).bindPopup(`<b>${p.n}</b><br>${p.d||""}`);
    markers.push(mk);
    const d=document.createElement("div"); d.className="place";
    d.innerHTML=`<div><b>${p.n}</b><br><small>${p.d||""} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</small></div>`;
    const btn=document.createElement("button"); btn.className="btn ghost small"; btn.textContent="Ver";
    btn.onclick=()=>{ map.setView([p.lat,p.lng],15); mk.openPopup(); };
    const maps=document.createElement("a"); maps.className="btn ghost small"; maps.textContent="Maps"; maps.target="_blank"; maps.rel="noopener";
    maps.href=`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
    placeRowButtons(d, p, [btn, maps]); box.appendChild(d);
  });
}
function renderPlacesNoMap(){
  const f=$("#place-filter")?$("#place-filter").value:"all", custom=App.places.list();
  const all=[...BASE_PLACES, ...custom];
  const box=$("#place-list"); if(!box) return; box.innerHTML="";
  all.filter(p=>f==="all"||p.c===f).forEach((p)=>{
    const d=document.createElement("div"); d.className="place";
    d.innerHTML=`<div><b>${p.n}</b><br><small>${p.d||""} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</small></div>`;
    const a=document.createElement("a"); a.className="btn ghost small"; a.textContent="Maps"; a.target="_blank"; a.rel="noopener";
    a.href=`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
    placeRowButtons(d, p, [a]); box.appendChild(d);
  });
}
$("#place-filter").onchange = renderPlaces;
$("#place-form").onsubmit = e=>{
  e.preventDefault();
  try{
    App.places.add({
      name: "📌 "+$("#pl-name").value,
      category: "extra",
      lat: parseFloat($("#pl-lat").value),
      lng: parseFloat($("#pl-lng").value),
      note: "Añadido por "+(loadWho()||"el grupo")
    });
  }catch(err){ alert("Revisa el nombre y las coordenadas del lugar"); return; }
  $("#pl-name").value="";$("#pl-lat").value="";$("#pl-lng").value="";
  renderPlaces();
};

// ---------- Objetivos oficiales (broma interna, solo local) ----------
const GOALS = [
  "Morillo liga con una trannie francesa",
  "Juan vuelve sin ets",
  "Monzón tu objetivo es no roncar tanto sólo",
  "Paco nos invita a todo",
  "Nadie pierde el vuelo de vuelta"
];
function loadGoals(){ try{return JSON.parse(localStorage.getItem("tls_goals")||"{}")}catch{return{}} }
function renderGoals(){
  const g=loadGoals(), box=$("#goals"); if(!box) return; box.innerHTML="";
  GOALS.forEach((t,i)=>{
    const l=document.createElement("label");
    l.innerHTML=`<input type="checkbox" ${g[i]?"checked":""} style="width:auto"> ${t}`;
    l.querySelector("input").onchange=e=>{ const gg=loadGoals(); gg[i]=e.target.checked; localStorage.setItem("tls_goals",JSON.stringify(gg)); };
    box.appendChild(l);
  });
}

// ---------- Tostada + easter eggs ----------
let toastTimer=null;
function toast(msg){
  const el=$("#toast"); if(!el) return;
  el.textContent=msg; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove("show"), 2800);
}
function tapEgg(el, taps, msg){
  if(!el) return;
  let n=0;
  el.onclick=()=>{ n++; if(n>=taps){ n=0; toast(msg); } };
}

// ---------- Checklist ----------
const CHECKS = ["Pasaportes/DNI","Billetes descargados","Gastos al día en la web","Taxi 4:30 del día 5 (team Sevilla)","Adaptadores / cargadores","Paco: llaves apartamento","Ganas de cassoulet"];
function loadChecks(){ try{return JSON.parse(localStorage.getItem(LS.checklist)||"{}")}catch{return{}} }
function renderChecks(){
  const c=loadChecks(), box=$("#checklist"); box.innerHTML="";
  CHECKS.forEach((t,i)=>{
    const l=document.createElement("label");
    l.innerHTML=`<input type="checkbox" ${c[i]?"checked":""} style="width:auto"> ${t}`;
    l.querySelector("input").onchange=e=>{ const cc=loadChecks(); cc[i]=e.target.checked; localStorage.setItem(LS.checklist,JSON.stringify(cc)); };
    box.appendChild(l);
  });
}

// ---------- Carga desde enlace compartido (compatible hacia atrás) ----------
function applyState(s){
  [LS.flights, LS.done, LS.checklist].forEach(k=>{ if(typeof s[k]==="string") localStorage.setItem(k, s[k]); });
  try{
    const st = JSON.parse(s[LS.exp]||"[]");
    App.expenses.importAll(st);
  }catch(e){ if(typeof s[LS.exp]==="string") localStorage.setItem(LS.exp, s[LS.exp]); }
  try{
    const pl = JSON.parse(s[LS.places]||"[]");
    App.places.importAll(pl);
  }catch(e){ if(typeof s[LS.places]==="string") localStorage.setItem(LS.places, s[LS.places]); }
  renderPlan(); renderFlights(); renderExpenses(); renderChecks(); renderPlaces();
}
function importFromHash(){
  if(!location.hash.startsWith("#d=")) return false;
  try{
    const b64 = location.hash.slice(3).replace(/-/g,"+").replace(/_/g,"/");
    const json = decodeURIComponent(escape(atob(b64)));
    applyState(JSON.parse(json));
    history.replaceState(null,"",location.pathname);
    alert("Datos del grupo cargados ✅");
    return true;
  }catch(e){ return false; }
}
$("#sync-refresh-exp").onclick = ()=>refreshFromCloud();
$("#sync-refresh-map").onclick = ()=>refreshFromCloud();

// Revelado único por tarjeta al entrar en vista (sin scroll listeners).
(function(){
  if(!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(es=>{
    es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
  },{threshold:.1});
  document.querySelectorAll("main .card").forEach(el=>{ el.classList.add("rv"); io.observe(el); });
})();

// ---------- init (raíz de composición del driver) ----------
App = window.TripApp.createApp({exp:LS.exp, places:LS.places}, setCloudStatus);
importFromHash();
renderProfileGrid(); updateWho(); renderPlan(); renderFlights(); renderExpenseForm(); renderExpenses(); renderChecks(); renderGoals(); initMap();
tapEgg($("#trip-title"), 5, "Logro desbloqueado: tranny certificado de la Ville Rose 🍆");
tapEgg($("#paco-egg"), 3, "Paco finge que no os conoce ✅");
App.ready.then(()=>{ renderExpenses(); renderPlaces(); });
if(!loadWho()) $("#profile-modal").classList.remove("hidden");
