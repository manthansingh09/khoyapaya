/* KhoyaPaya Command Center — live operational dashboard
   All intelligence runs client-side over the augmented dataset (data.json).
   The missing-person records are never mutated; we only read + augment. */

let DATA, map, state = {sel:null, filtered:[]};
const L_ = L; // alias

// ---------- geo utils ----------
const R=6371000, rad=d=>d*Math.PI/180;
function hav(a,b,c,d){const dl=rad(c-a),dn=rad(d-b);
  const x=Math.sin(dl/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dn/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));}
const km=m=>(m/1000).toFixed(2);
function nearest(lat,lng,arr,n=1){
  return arr.map(o=>({o,d:hav(lat,lng,o.lat,o.lng)})).sort((a,b)=>a.d-b.d).slice(0,n);
}

// ---------- layer groups ----------
const layers={};
const LDEF=[
  {k:"missing", name:"Missing reports", color:"#ff5a6e", on:true},
  {k:"heat",    name:"Missing heatmap", color:"#ff8a3d", on:false},
  {k:"cctv",    name:"CCTV cameras",    color:"#4d8dff", on:false},
  {k:"police",  name:"Police stations", color:"#2fd180", on:true},
  {k:"vol",     name:"Volunteers", color:"#1a7f4b", on:false},
  {k:"choke",   name:"Chokepoints / parking", color:"#ffb020", on:false},
  {k:"zones",   name:"Zone risk index",  color:"#7c5cff", on:true},
  {k:"blind",   name:"CCTV blind-spots", color:"#ff2d6e", on:false},
];

// ---------- boot ----------
fetch("data.json").then(r=>r.json()).then(d=>{DATA=d; init();})
  .catch(e=>document.getElementById("map").innerHTML=
    '<div style="padding:40px;color:#fff">Could not load data.json — start via run script. '+e+'</div>');

function init(){
  buildKPIs(); buildFilters(); buildLayerToggles(); buildLegend();
  map=L_.map("map",{zoomControl:true,preferCanvas:true}).setView(DATA.meta.center,12);
  L_.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{
    attribution:'&copy; OpenStreetMap &copy; CARTO',subdomains:"abcd",maxZoom:20}).addTo(map);

  buildStaticLayers();
  applyFilters();
  // default visibility
  LDEF.forEach(l=>{ if(l.on && layers[l.k]) layers[l.k].addTo(map); });
  document.querySelectorAll("#q,#f-status,#f-age,#f-gender,#f-loc")
    .forEach(el=>el.addEventListener("input",applyFilters));
  buildSemanticIndex();
  initReportModal();
  initYolo();
  // re-translate dynamic widgets when the language changes
  document.addEventListener("kp:lang",()=>{
    buildKPIs(); buildLegend(); yoloBtnLabel();
    document.querySelectorAll(".lname").forEach(el=>el.textContent=t("lay_"+el.dataset.lk));
    renderCaseList();
    if(state.sel){const m=DATA.missing.find(x=>x.id===state.sel); if(m)renderCommand(m);}
  });
}

// ---------- header KPIs ----------
function buildKPIs(){
  const m=DATA.meta;
  const items=[
    {v:m.missing,l:t("kpi_reports"),c:""},
    {v:m.reunited,l:t("kpi_reunited"),c:"ok"},
    {v:m.open,l:t("kpi_open"),c:"bad"},
    {v:m.cameras,l:t("kpi_cctv"),c:"acc"},
    {v:m.police,l:t("kpi_police"),c:""},
    {v:m.volunteers,l:t("kpi_vol"),c:"ok"},
    {v:m.zones,l:t("kpi_zones"),c:""},
  ];
  document.getElementById("kpis").innerHTML=items.map(i=>
    `<div class="kpi ${i.c}"><div class="v">${i.v}</div><div class="l">${i.l}</div></div>`).join("");
}

// ---------- filters ----------
function uniq(f){return [...new Set(DATA.missing.map(f))].sort();}
function buildFilters(){
  fill("f-status",["All",...uniq(m=>m.status)]);
  fill("f-age",["All",...uniq(m=>m.age)]);
  fill("f-gender",["All",...uniq(m=>m.gender)]);
  fill("f-loc",["All",...uniq(m=>m.loc)]);
}
function fill(id,opts){
  document.getElementById(id).innerHTML=opts.map(o=>`<option>${o}</option>`).join("");
}
function applyFilters(){
  const q=document.getElementById("q").value.toLowerCase().trim();
  const st=val("f-status"),ag=val("f-age"),ge=val("f-gender"),lo=val("f-loc");
  state.filtered=DATA.missing.filter(m=>{
    if(st!=="All"&&m.status!==st)return false;
    if(ag!=="All"&&m.age!==ag)return false;
    if(ge!=="All"&&m.gender!==ge)return false;
    if(lo!=="All"&&m.loc!==lo)return false;
    if(q&&!(m.name.toLowerCase().includes(q)||m.id.toLowerCase().includes(q)||
            m.loc.toLowerCase().includes(q)||m.home.toLowerCase().includes(q)))return false;
    return true;
  });
  renderMissing(); renderCaseList();
}
const val=id=>document.getElementById(id).value;

// ---------- static infra layers ----------
function statusClass(s){return s==="Transferred to hospital"?"Transferred":s;}
function buildStaticLayers(){
  // CCTV
  layers.cctv=L_.layerGroup(DATA.cameras.map(c=>
    L_.circleMarker([c.lat,c.lng],{radius:3,color:"#4d8dff",weight:1,
      fillColor:"#4d8dff",fillOpacity:.6}).bindPopup(`<div class="pin-pop">📷 <b>${c.id}</b></div>`)
      .bindTooltip(`📷 ${c.id}`,{direction:"top"})));
  // Police
  layers.police=L_.layerGroup(DATA.police.map(s=>
    L_.marker([s.lat,s.lng],{icon:emoji("🚓")}).bindPopup(
      `<div class="pin-pop">🚓 <b>${s.name}</b></div>`)
      .bindTooltip(`🚓 ${s.name}`,{direction:"top"})));
  // Volunteers
  layers.vol=L_.layerGroup();
  refreshVolunteerLayer();
  // Chokepoints
  const ccol={"Transfer node":"#7c5cff","Traffic choke point":"#ffb020",
    "No-vehicle pressure zone":"#ff5a6e","Parking":"#36c5d0","Parking belt":"#36c5d0",
    "Outer parking":"#2fd180"};
  layers.choke=L_.layerGroup(DATA.chokepoints.map(c=>
    L_.circleMarker([c.lat,c.lng],{radius:6,color:ccol[c.category]||"#aaa",weight:1.5,
      fillColor:ccol[c.category]||"#aaa",fillOpacity:.5}).bindPopup(
      `<div class="pin-pop">📍 <b>${c.name}</b><br><small>${c.category}</small></div>`)
      .bindTooltip(`📍 ${c.name} · ${c.category}`,{sticky:true})));
  // Zones (risk circles) — hover shows the area name + risk
  layers.zones=L_.layerGroup(DATA.zones.map(z=>{
    const r=z.stats.risk, col=riskColor(r);
    return L_.circle([z.lat,z.lng],{radius:380,color:col,weight:1.5,fillColor:col,fillOpacity:.13})
      .bindPopup(zonePopup(z))
      .bindTooltip(`<b>${z.name}</b> · risk ${r}/100 · ${z.stats.cases} reports`,
                   {sticky:true,className:"zone-tip"});}));
  // Blind spots
  layers.blind=L_.layerGroup(DATA.blindspots.map(b=>
    L_.circle([b.lat,b.lng],{radius:480,color:"#ff2d6e",weight:2,dashArray:"6 5",
      fillColor:"#ff2d6e",fillOpacity:.12}).bindPopup(
      `<div class="pin-pop">⚠️ <b>${b.zone}</b><br>Blind-spot score <b>${b.blind}</b><br>
       ${b.cases} reports · only ${b.cameras} cameras nearby<br>
       <small>Recommend: mobile camera / drone / volunteer tower</small></div>`)
      .bindTooltip(`⚠️ ${b.zone} · blind-spot ${b.blind}`,{sticky:true})));
}
function emoji(e){return L_.divIcon({html:`<div style="font-size:20px;filter:drop-shadow(0 2px 3px #000)">${e}</div>`,
  className:"",iconSize:[24,24],iconAnchor:[12,12]});}
function riskColor(r){return r>=70?"#ff5a6e":r>=45?"#ffb020":"#2fd180";}
function zonePopup(z){const s=z.stats;return `<div class="pin-pop">🟣 <b>${z.name}</b>
  <br>Risk index <b style="color:${riskColor(s.risk)}">${s.risk}/100</b>
  <br>${s.cases} reports · ${s.elder_pct}% elderly
  <br>${s.cameras} cameras · ${s.chokepoints} chokepoints
  <br>Nearest police ${s.police_km} km
  <br><small>${s.reasons.join(" · ")}</small></div>`;}

// ---------- missing layer (cluster + heat) ----------
function renderMissing(){
  if(layers.missing)map.removeLayer(layers.missing);
  if(layers.heat)map.removeLayer(layers.heat);
  const onM=isOn("missing"), onH=isOn("heat");
  const cluster=L_.markerClusterGroup({maxClusterRadius:45,spiderfyOnMaxZoom:true,
    chunkedLoading:true,iconCreateFunction:c=>{
      const n=c.getChildCount();
      return L_.divIcon({html:`<div style="background:rgba(255,90,110,.85);color:#fff;border-radius:50%;
        width:34px;height:34px;display:grid;place-items:center;font-weight:700;
        border:2px solid #fff3">${n}</div>`,className:"",iconSize:[34,34]});}});
  const scol={"Reunited":"#2fd180","Unresolved":"#ff5a6e","Pending":"#ffb020",
    "Transferred to hospital":"#4d8dff"};
  state.filtered.forEach(m=>{
    const mk=L_.circleMarker([m.lat,m.lng],{radius:5,color:"#0b1020",weight:1,
      fillColor:scol[m.status]||"#ff5a6e",fillOpacity:.9});
    mk.on("click",()=>selectCase(m.id));
    mk.bindTooltip(`${m.name} · ${m.age} · ${m.loc}`,{direction:"top"});
    cluster.addLayer(mk);
  });
  layers.missing=cluster;
  layers.heat=L_.heatLayer(state.filtered.map(m=>[m.lat,m.lng,0.6]),
    {radius:24,blur:18,maxZoom:14,gradient:{0.2:"#3b6",0.5:"#fb0",0.8:"#f60",1:"#f06"}});
  if(onM)cluster.addTo(map);
  if(onH)layers.heat.addTo(map);
}

// ---------- layer toggles ----------
function buildLayerToggles(){
  document.getElementById("layers").innerHTML=LDEF.map(l=>
    `<div class="tg ${l.on?"on":""}" data-k="${l.k}">
       <span><span class="swatch" style="background:${l.color}"></span><span class="lname" data-lk="${l.k}">${t("lay_"+l.k)}</span></span>
       <span class="sw"></span></div>`).join("");
  document.querySelectorAll(".tg").forEach(t=>t.addEventListener("click",()=>{
    const k=t.dataset.k, on=!t.classList.contains("on");
    t.classList.toggle("on",on);
    const lg=layers[k]; if(!lg)return;
    if(on)lg.addTo(map); else map.removeLayer(lg);
  }));
}
const isOn=k=>document.querySelector(`.tg[data-k="${k}"]`)?.classList.contains("on");

// ---------- legend ----------
function buildLegend(){
  document.getElementById("legend").innerHTML=`
   <div style="font-weight:700;margin-bottom:5px">${t("leg_title")}</div>
   <div class="row"><span class="sw" style="background:#2fd180"></span>${t("kpi_reunited")}</div>
   <div class="row"><span class="sw" style="background:#ff5a6e"></span>${t("leg_unresolved")}</div>
   <div class="row"><span class="sw" style="background:#ffb020"></span>${t("leg_pending")}</div>
   <div class="row"><span class="sw" style="background:#4d8dff"></span>${t("leg_hospital")}</div>
   <div class="row"><span class="sw" style="background:#7c5cff"></span>${t("leg_zone")}</div>
   <div class="row"><span class="sw" style="background:#1a7f4b"></span>${t("leg_vol")}</div>
   <div class="row"><span class="sw" style="background:#c62330"></span>${t("leg_flag")}</div>`;
}

// ---------- case list ----------
function renderCaseList(){
  document.getElementById("caseCount").textContent=`${state.filtered.length} ${t("shown")}`;
  const html=state.filtered.slice(0,400).map(m=>{
    const sc=statusClass(m.status);
    return `<div class="case ${state.sel===m.id?"active":""}" data-id="${m.id}">
      <div class="top"><span class="nm">${m.name}</span>
        <span class="badge b-${sc}">${m.status.split(" ")[0]}</span></div>
      <div class="meta">${m.age} · ${m.gender} · 📍 ${m.loc}</div>
      <div class="meta">${m.id} · ${m.ts}</div></div>`;}).join("");
  const list=document.getElementById("caselist");
  list.innerHTML=html+(state.filtered.length>400?
    `<div style="padding:10px 14px;color:#8ea0c4;font-size:11px">+${state.filtered.length-400} more — refine filters</div>`:"");
  list.querySelectorAll(".case").forEach(c=>c.addEventListener("click",()=>selectCase(c.dataset.id)));
}

// ================= COMMAND CENTER (the AI workflow) =================
function selectCase(id){
  const m=DATA.missing.find(x=>x.id===id); if(!m)return;
  state.sel=id; renderCaseList();
  map.flyTo([m.lat,m.lng],15,{duration:.7});
  drawCaseLayer(m);
  renderCommand(m);
}

// transient layer for the selected case (search radius, route, cctv links)
let caseLayer;
function drawCaseLayer(m){
  if(caseLayer)map.removeLayer(caseLayer);
  clearVehicle();
  caseLayer=L_.layerGroup().addTo(map);
  // search radius rings
  [350,750,1300].forEach((r,i)=>L_.circle([m.lat,m.lng],{radius:r,color:"#4d8dff",
    weight:1,fillColor:"#4d8dff",fillOpacity:i===0?.08:.04,dashArray:"4 6"}).addTo(caseLayer));
  // last seen marker
  L_.marker([m.lat,m.lng],{icon:emoji("🔴"),zIndexOffset:1000})
    .bindPopup(`<b>${m.name}</b><br>Last seen: ${m.loc}`).addTo(caseLayer).openPopup();
  // recommended cameras
  recommendCameras(m).forEach(c=>{
    L_.polyline([[m.lat,m.lng],[c.o.lat,c.o.lng]],{color:"#4d8dff",weight:1,opacity:.4,dashArray:"3 4"}).addTo(caseLayer);
    L_.circleMarker([c.o.lat,c.o.lng],{radius:6,color:"#fff",weight:2,fillColor:"#0b3d91",fillOpacity:1})
      .bindPopup(`📷 <b>${c.o.id}</b><br>${Math.round(c.d)} m`).addTo(caseLayer);
  });
  // likely route
  const route=buildRoute(m);
  L_.polyline(route.map(r=>[r.lat,r.lng]),{color:"#7c5cff",weight:3,opacity:.8}).addTo(caseLayer);
}

// --- AI module 1: search radius prediction ---
function searchRadius(m){
  const W={"No-vehicle pressure zone":1.0,"Transfer node":0.95,"Parking belt":0.8,
    "Outer parking":0.78,"Parking":0.6,"Traffic choke point":0.7};
  const elder=["61-70","71-80","80+"].includes(m.age);
  const child=["0-12","13-17"].includes(m.age);
  let cand=DATA.chokepoints.map(c=>{
    const d=hav(m.lat,m.lng,c.lat,c.lng);
    let s=(W[c.category]||0.5)*Math.exp(-d/700);
    if(elder&&c.category==="No-vehicle pressure zone")s*=1.3; // elderly drift to ghats/kund
    if(elder&&c.category==="Transfer node")s*=0.8;
    if(child&&c.category.includes("Parking"))s*=1.2;          // children toward open/parking belts
    return {c,d,s};
  }).filter(x=>x.d<2600).sort((a,b)=>b.s-a.s).slice(0,4);
  const tot=cand.reduce((a,b)=>a+b.s,0)||1;
  return cand.map(x=>({...x,pct:Math.round(x.s/tot*100)}));
}
// --- AI module 2: CCTV recommendation (walking-direction aware ranking) ---
function recommendCameras(m){
  // bias toward cameras lying between last-seen and the top predicted corridor
  const pred=searchRadius(m)[0];
  return DATA.cameras.map(c=>{
    let d=hav(m.lat,m.lng,c.lat,c.lng);
    if(pred){const dd=hav(c.lat,c.lng,pred.c.lat,pred.c.lng);d=d*0.6+dd*0.4;}
    return {o:c,d};
  }).sort((a,b)=>a.d-b.d).slice(0,5);
}
// --- AI module 3: likely route ---
function buildRoute(m){
  const pts=[{lat:m.lat,lng:m.lng,n:m.loc,t:"Last seen"}];
  const tn=DATA.chokepoints.filter(c=>c.category==="Transfer node");
  const op=DATA.chokepoints.filter(c=>c.category==="Outer parking");
  const a=nearest(m.lat,m.lng,tn,1)[0]; if(a)pts.push({...a.o,n:a.o.name,t:"Transfer node"});
  const b=nearest(a?a.o.lat:m.lat,a?a.o.lng:m.lng,op,1)[0]; if(b)pts.push({...b.o,n:b.o.name,t:"Outer parking / exit"});
  const ps=nearest(m.lat,m.lng,DATA.police,1)[0]; if(ps)pts.push({lat:ps.o.lat,lng:ps.o.lng,n:ps.o.name,t:"Police station"});
  return pts;
}
// --- AI module 4: similar cases ---
function similarCases(m){
  return DATA.missing.filter(x=>x.id!==m.id&&x.loc===m.loc&&x.age===m.age)
    .slice(0,5);
}
// --- response estimate ---
function responseEst(d){const walk=Math.round(d/1.3/60),drive=Math.max(2,Math.round(d/420));
  return {walk,drive};}

function renderCommand(m){
  const z=DATA.zones.find(x=>x.name===m.zone), zr=z?z.stats.risk:0;
  const pred=searchRadius(m), cams=recommendCameras(m), route=buildRoute(m);
  const sim=similarCases(m);
  const ps=nearest(m.lat,m.lng,DATA.police,1)[0];
  const eta=responseEst(ps.d);
  const open=["Unresolved","Pending"].includes(m.status);

  const html=`
  <div class="cc-head">
    <div class="risk-ring" style="background:conic-gradient(${riskColor(zr)} ${zr*3.6}deg,rgba(255,255,255,.25) 0);">
      <div style="width:46px;height:46px;border-radius:50%;background:#fff;display:grid;place-items:center">
        <span style="color:${riskColor(zr)}">${zr}</span></div></div>
    <div class="nm">${m.name}</div>
    <div class="sub">${m.id} · reported ${m.ts}</div>
    <div class="cc-tags">
      <span class="tag">${m.age}</span><span class="tag">${m.gender}</span>
      <span class="badge b-${statusClass(m.status)}">${m.status}</span>
      <span class="tag">📍 ${m.loc}</span><span class="tag">🏠 ${m.home}</span>
      <span class="tag">🗣 ${m.lang}</span>${m.dup?'<span class="tag">⚠ duplicate?</span>':""}</div>
    <div style="font-size:12px;color:#aeb9d6;margin-top:9px">📝 ${m.desc}</div>
  </div>

  ${open?`<div class="block"><div class="alert">⏱ <b>ACTIVE CASE</b> — last seen at ${m.loc}.
     Nearest unit can reach in ~${eta.drive} min by vehicle. Deploy CCTV review + ground team.</div></div>`:""}

  <div class="block">
    <h4>🎯 ${t("cc_search")}</h4>
    ${pred.map((x,i)=>`<div class="rank">
       <span class="n">${i+1}</span>
       <span class="lab">${x.c.name}<small>${x.c.category} · ${Math.round(x.d)} m away</small>
         <div class="bar"><i style="width:${x.pct}%"></i></div></span>
       <span class="pct">${x.pct}%</span></div>`).join("")}
    <div style="font-size:11px;color:#8ea0c4;margin-top:4px">Probable movement corridors weighted by
       pedestrian flow, distance &amp; age profile.</div>
  </div>

  <div class="block">
    <h4>📷 ${t("cc_cctv")}</h4>
    ${cams.map(c=>`<div class="cam" data-lat="${c.o.lat}" data-lng="${c.o.lng}">
       <span class="id">${c.o.id}</span> <span class="d">${Math.round(c.d)} m</span></div>`).join("")}
    <div style="font-size:11px;color:#8ea0c4">From 1,280 cameras → top 5 along the predicted corridor.</div>
  </div>

  <div class="block">
    <h4>🚓 ${t("cc_vehicle")}</h4>
    <div class="kv"><span>${t("cc_unit")}</span><b>${ps.o.name}</b></div>
    <div class="kv"><span>${t("cc_straight")}</span><b>${km(ps.d)} km</b></div>
    <div class="kv"><span>${t("cc_roaddist")}</span><b id="vehDist">${t("cc_routing")}</b></div>
    <div class="kv"><span>${t("cc_eta")}</span><b id="vehEta">—</b></div>
    <div class="kv"><span>${t("cc_zone")}</span><b>${m.zone} · risk ${zr}/100</b></div>
    <button class="search-btn" id="replayVeh" style="margin-top:8px">${t("cc_replay")}</button>
  </div>

  <div class="block">
    <h4>🧭 ${t("cc_route")}</h4>
    <div class="route">${route.map((r,i)=>`
      <div class="step"><div class="ln"><div class="ico">${["🔴","🚉","🅿️","🚓"][i]||"•"}</div></div>
        <div class="tx">${r.n}<small>${r.t}</small></div></div>`).join("")}</div>
  </div>

  <div class="block" style="border-bottom:none">
    <h4>👥 ${t("cc_similar")} <span style="color:#8ea0c4;font-weight:400">(${sim.length})</span></h4>
    ${sim.length?sim.map(s=>`<div class="simcase" data-id="${s.id}">
       <b>${s.name}</b> — ${s.status}
       <div class="d">${s.age} · ${s.gender} · ${s.ts}</div></div>`).join("")
      :'<div style="font-size:12px;color:#8ea0c4">No matching profile at this location.</div>'}
  </div>`;
  const cmd=document.getElementById("cmd");
  cmd.innerHTML=html; cmd.scrollTop=0;
  cmd.querySelectorAll(".cam").forEach(c=>c.addEventListener("click",()=>
    map.flyTo([+c.dataset.lat,+c.dataset.lng],17,{duration:.6})));
  cmd.querySelectorAll(".simcase").forEach(c=>c.addEventListener("click",()=>selectCase(c.dataset.id)));
  // road-route the police vehicle from nearest station to this stop, then animate it
  const rv=document.getElementById("replayVeh");
  if(rv)rv.addEventListener("click",()=>dispatchVehicle(m,true));
  dispatchVehicle(m,false);
  // dispatch panel if this case has a live dispatch
  const disp=DISPATCHES[m.id];
  if(disp){
    const blk=document.createElement("div");blk.className="block";blk.style.borderBottom="none";
    blk.innerHTML=`<h4>📡 ${t("cc_dispatch")}</h4><div class="dispatch">${disp.map(renderDispEntry).join("")}</div>`;
    cmd.appendChild(blk);
  }else if(open){
    const blk=document.createElement("div");blk.className="block";blk.style.borderBottom="none";
    blk.innerHTML=`<button class="search-btn" id="doDispatch">📡 ${t("cc_dispatch_btn")}</button>`;
    cmd.appendChild(blk);
    document.getElementById("doDispatch").addEventListener("click",()=>{dispatchCase(m);renderCommand(m);});
  }
}

/* ===================================================================
   VOLUNTEERS layer
   =================================================================== */
function volIcon(status){
  return L_.divIcon({className:"",iconSize:[20,20],iconAnchor:[10,10],
    html:`<div class="vol-ico">${status==="Available"?"🟢":"🟠"}🚶</div>`});
}
function refreshVolunteerLayer(){
  if(!layers.vol)return;
  layers.vol.clearLayers();
  DATA.volunteers.forEach(v=>{
    L_.marker([v.lat,v.lng],{icon:volIcon(v.status)}).bindPopup(
      `<div class="pin-pop">🧑‍🤝‍🧑 <b>${v.name}</b> · ${v.id}
       <br>Status: <b>${v.status}</b> · ⭐ ${v.rating}
       <br>Skills: ${v.skills.join(", ")}
       <br>Langs: ${v.langs.join(", ")}
       <br>${v.phone}</div>`)
      .bindTooltip(`${v.status==="Available"?"🟢":"🟠"} ${v.name} · ${v.id}`,{direction:"top"})
      .addTo(layers.vol);
  });
}

/* ===================================================================
   SEMANTIC INDEX  (TF-IDF cosine + field heuristics) for duplicates
   =================================================================== */
let IDF={}, VEC=new Map();
const STOP=new Set("the a an in on of has have with and is to near at her his him she he".split(" "));
function tokens(s){return (s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/)
  .filter(t=>t.length>2&&!STOP.has(t));}
function docText(m){return `${m.name} ${m.desc} ${m.loc} ${m.lang}`;}
function tf(toks){const f={};toks.forEach(t=>f[t]=(f[t]||0)+1);
  const n=toks.length||1;Object.keys(f).forEach(k=>f[k]/=n);return f;}
function buildSemanticIndex(){
  const df={};const N=DATA.missing.length;
  DATA.missing.forEach(m=>{[...new Set(tokens(docText(m)))].forEach(t=>df[t]=(df[t]||0)+1);});
  IDF={};Object.keys(df).forEach(t=>IDF[t]=Math.log((N+1)/(df[t]+1))+1);
  DATA.missing.forEach(m=>VEC.set(m.id,vectorize(docText(m))));
}
function vectorize(text){
  const f=tf(tokens(text));const v={};let nrm=0;
  Object.keys(f).forEach(t=>{const w=f[t]*(IDF[t]||Math.log(DATA.missing.length)); v[t]=w; nrm+=w*w;});
  nrm=Math.sqrt(nrm)||1;Object.keys(v).forEach(t=>v[t]/=nrm);return v;
}
function cosine(a,b){let s=0;const sm=Object.keys(a).length<Object.keys(b).length?a:b,bg=sm===a?b:a;
  for(const t in sm)if(bg[t])s+=sm[t]*bg[t];return s;}
function bigrams(s){s=(s||"").toLowerCase();const g=[];for(let i=0;i<s.length-1;i++)g.push(s.slice(i,i+2));return g;}
function dice(a,b){const A=bigrams(a),B=bigrams(b);if(!A.length||!B.length)return 0;
  const cnt={};A.forEach(g=>cnt[g]=(cnt[g]||0)+1);let m=0;B.forEach(g=>{if(cnt[g]>0){cnt[g]--;m++;}});
  return 2*m/(A.length+B.length);}

// score similarity between a candidate (form object) and an existing record
function dupScore(cand,m){
  const vc=vectorize(`${cand.name} ${cand.desc} ${cand.loc} ${cand.lang}`);
  const cos=cosine(vc,VEC.get(m.id)||vectorize(docText(m)));
  const nm=dice(cand.name,m.name);
  let s=0.5*cos+0.22*nm;
  const why=[];
  if(cos>0.25)why.push("similar description");
  if(nm>0.55)why.push("similar name");
  if(cand.loc&&cand.loc===m.loc){s+=0.16;why.push("same last-seen spot");}
  if(cand.age&&cand.age===m.age){s+=0.07;why.push("same age band");}
  if(cand.gender&&cand.gender===m.gender){s+=0.05;}
  return {m,score:Math.min(1,s),why};
}
function findDuplicates(cand,k=4){
  return DATA.missing.map(m=>dupScore(cand,m)).filter(x=>x.score>0.30)
    .sort((a,b)=>b.score-a.score).slice(0,k);
}

/* ===================================================================
   REPORT INTAKE MODAL
   =================================================================== */
function initReportModal(){
  fill("r-age",uniq(m=>m.age)); fill("r-gender",uniq(m=>m.gender)); fill("r-loc",uniq(m=>m.loc));
  const bg=document.getElementById("reportModal");
  const closeModal=()=>{if(window.KPVoice)KPVoice.stop();bg.classList.remove("show");};
  document.getElementById("btn-report").onclick=()=>{bg.classList.add("show");document.getElementById("dupZone").innerHTML="";};
  document.getElementById("reportClose").onclick=closeModal;
  bg.addEventListener("click",e=>{if(e.target===bg)closeModal();});
  document.getElementById("r-check").onclick=runDupCheck;
  document.getElementById("r-file").onclick=fileReport;
  setupVoice();
}

/* ---- voice-guided intake (Web Speech API) ---- */
function setupVoice(){
  const start=document.getElementById("v-start"), stop=document.getElementById("v-stop");
  const status=document.getElementById("v-status"), mic=document.getElementById("v-mic");
  const trans=document.getElementById("v-transcript");
  if(!start)return;
  if(!window.KPVoice||!KPVoice.supported()){
    start.disabled=true; status.removeAttribute("data-i18n"); status.textContent=t("v_unsupported"); return;
  }
  const setStatus=s=>{status.removeAttribute("data-i18n");status.textContent=s;};
  stop.onclick=()=>KPVoice.stop();

  // ---- free-form: one spoken sentence -> Claude extracts every field ----
  const aiBtn=document.getElementById("v-ai");
  if(aiBtn) aiBtn.onclick=async()=>{
    KPVoice.resetAbort();
    start.style.display="none"; stop.style.display=""; mic.classList.add("on"); trans.textContent="";
    document.getElementById("r-lang").value=langName(KPVoice.lang());
    try{
      setStatus("🔊 "+t("v_speaking")); await KPVoice.speak(t("v_ai_ask"));
      if(KPVoice.isAborted())return;
      setStatus("🎙️ "+t("v_listening")); mic.classList.add("live");
      let heard=""; try{heard=await KPVoice.listen(iv=>{trans.textContent=iv;});}catch(e){heard="";}
      mic.classList.remove("live");
      if(!heard){setStatus(t("v_unclear"));return;}
      trans.textContent=t("v_heard")+": "+heard;
      setStatus("🧠 "+t("v_ai_working"));
      // ask the server (Claude) to extract structured fields
      let filled=false;
      try{
        const res=await fetch("/api/extract",{method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({transcript:heard})});
        if(res.ok){const j=await res.json(); if(j.ok){applyExtracted(j.fields); filled=true;}}
      }catch(e){}
      if(filled){setStatus("✅ "+t("v_ai_done")); await KPVoice.speak(t("v_ai_done"));}
      else{ // fallback: local heuristics on the same transcript
        document.getElementById("r-desc").value=heard;
        const a=KPVoice.parseAge(heard); if(a)setSelect("r-age",a);
        const g=KPVoice.parseGender(heard); if(g)setSelect("r-gender",g);
        const opts=[...document.getElementById("r-loc").options].map(o=>o.value);
        const mm=KPVoice.matchLocation(heard,opts); if(mm)setSelect("r-loc",mm);
        setStatus("⚠️ "+t("v_ai_unavail")); await KPVoice.speak(t("v_ai_unavail"));
      }
    }catch(e){setStatus(t("v_unsupported"));}
    finally{start.style.display=""; stop.style.display="none"; mic.classList.remove("on","live");}
  };
  start.onclick=async()=>{
    KPVoice.resetAbort();
    start.style.display="none"; stop.style.display=""; mic.classList.add("on"); trans.textContent="";
    document.getElementById("r-lang").value=langName(KPVoice.lang());
    const steps=[
      {ask:"v_ask_name",  fill:txt=>{document.getElementById("r-name").value=cap(txt);}},
      {ask:"v_ask_age",   fill:txt=>{const a=KPVoice.parseAge(txt); if(a)setSelect("r-age",a);}},
      {ask:"v_ask_gender",fill:txt=>{const g=KPVoice.parseGender(txt); if(g)setSelect("r-gender",g);}},
      {ask:"v_ask_loc",   fill:txt=>{const opts=[...document.getElementById("r-loc").options].map(o=>o.value);
          const mm=KPVoice.matchLocation(txt,opts); if(mm)setSelect("r-loc",mm);}},
      {ask:"v_ask_desc",  fill:txt=>{document.getElementById("r-desc").value=txt;}},
    ];
    try{
      await KPVoice.speak(t("v_greet"));
      for(const st of steps){
        if(KPVoice.isAborted())break;
        setStatus("🔊 "+t("v_speaking")); await KPVoice.speak(t(st.ask));
        if(KPVoice.isAborted())break;
        setStatus("🎙️ "+t("v_listening")); mic.classList.add("live");
        let heard=""; try{heard=await KPVoice.listen(iv=>{trans.textContent=iv;});}catch(e){heard="";}
        mic.classList.remove("live");
        if(heard){st.fill(heard); trans.textContent=t("v_heard")+": "+heard;}
      }
      if(!KPVoice.isAborted()){setStatus("✅"); await KPVoice.speak(t("v_done"));}
    }catch(e){setStatus(t("v_unsupported"));}
    finally{start.style.display=""; stop.style.display="none"; mic.classList.remove("on","live");}
  };
}
function applyExtracted(f){
  if(!f)return;
  if(f.name)document.getElementById("r-name").value=f.name;
  if(f.desc||f.description)document.getElementById("r-desc").value=f.description||f.desc;
  if(f.language)document.getElementById("r-lang").value=f.language;
  if(f.age_band)setSelect("r-age",f.age_band);
  if(f.gender)setSelect("r-gender",f.gender);
  if(f.location)setSelect("r-loc",f.location);
}
function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
function setSelect(id,v){const el=document.getElementById(id);
  if([...el.options].some(o=>o.value===v)){el.value=v;el.style.background="#e3f5ea";setTimeout(()=>el.style.background="",1000);}}
function langName(l){return {en:"English",hi:"Hindi",mr:"Marathi",gu:"Gujarati",ta:"Tamil"}[l]||"Hindi";}
function formCand(){
  return {name:val("r-name").trim(),age:val("r-age"),gender:val("r-gender"),
    loc:val("r-loc"),lang:val("r-lang").trim()||"Hindi",desc:val("r-desc").trim(),
    phone:val("r-phone").trim()};
}
function runDupCheck(){
  const c=formCand();
  if(!c.name&&!c.desc){alert("Enter a name or description first.");return;}
  const dups=findDuplicates(c);
  const zone=document.getElementById("dupZone");
  if(!dups.length){
    zone.innerHTML=`<div class="dup-head"><span class="pill ok">NO DUPLICATES</span>
      No similar open record found — safe to file as a new case.</div>`;return;
  }
  const top=dups[0].score;
  zone.innerHTML=`<div class="dup-head">
     <span class="pill ${top>0.6?"warn":"ok"}">${top>0.6?"POSSIBLE DUPLICATES":"WEAK MATCHES"}</span>
     Semantic search across ${DATA.missing.length} records</div>`+
    dups.map(d=>{const pc=Math.round(d.score*100),col=d.score>0.6?"#c62330":d.score>0.45?"#b8730a":"#5a6a86";
      return `<div class="dup ${d.score>0.6?"high":""}">
        <div class="score" style="background:${col}">${pc}%</div>
        <div class="info"><b>${d.m.name}</b> · ${d.m.id}
          <div class="d">${d.m.age} · ${d.m.gender} · 📍 ${d.m.loc} · ${d.m.status}</div>
          <div class="d">${d.m.desc}</div>
          <div class="why">▸ matched on: ${d.why.join(", ")||"text similarity"}</div></div>
        <button class="btn ghost" style="padding:6px 10px" onclick="viewExisting('${d.m.id}')">View</button>
      </div>`;}).join("");
}
window.viewExisting=id=>{document.getElementById("reportModal").classList.remove("show");selectCase(id);};

let NEWSEQ=9000;
function fileReport(){
  const c=formCand();
  if(!c.name||!c.desc){alert("Name and description are required.");return;}
  // duplicate guard
  const dups=findDuplicates(c);
  if(dups.length&&dups[0].score>0.7){
    if(!confirm(`A very similar record exists (${Math.round(dups[0].score*100)}% — ${dups[0].m.name}, ${dups[0].m.id}).\nFile anyway as a new case?`)){
      runDupCheck();return;
    }
  }
  const base=GEOFROM(c.loc);
  const id=`KMP-2027-0${++NEWSEQ}`;
  const rec={id,name:c.name,gender:c.gender,age:c.age,status:"Unresolved",
    ts:nowStr(),loc:c.loc,lat:base[0],lng:base[1],zone:nearestZone(base[0],base[1]),
    lang:c.lang,home:"Walk-in report",desc:c.desc,center:"Live Intake Desk",dup:false,isNew:true};
  DATA.missing.unshift(rec);
  VEC.set(id,vectorize(docText(rec)));
  DATA.meta.open++;
  buildKPIs();
  document.getElementById("reportModal").classList.remove("show");
  applyFilters();
  dispatchCase(rec);          // <<< automation
  selectCase(id);
}
function GEOFROM(loc){
  // anchor to an existing record at the same location, with small jitter so pins don't stack
  const ex=DATA.missing.find(m=>m.loc===loc&&!m.isNew);
  if(ex){const j=(Math.random()-0.5)*0.0025;return [ex.lat+j, ex.lng+(Math.random()-0.5)*0.0025];}
  return DATA.meta.center;
}
function nearestZone(lat,lng){
  return DATA.zones.reduce((b,z)=>{const d=hav(lat,lng,z.lat,z.lng);return d<b.d?{d,n:z.name}:b;},{d:1e9,n:""}).n;
}
function nowStr(){const d=new Date();const p=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;}

/* ===================================================================
   AUTO-DISPATCH  (volunteers + police + CCTV notified automatically)
   =================================================================== */
const DISPATCHES={};
function dispatchCase(m){
  // nearest available volunteers
  const avail=DATA.volunteers.filter(v=>v.status==="Available")
    .map(v=>({v,d:hav(m.lat,m.lng,v.lat,v.lng)})).sort((a,b)=>a.d-b.d).slice(0,3);
  const ps=nearest(m.lat,m.lng,DATA.police,1)[0];
  const cams=recommendCameras(m).slice(0,3);
  const log=[];
  const t=()=>nowTime();
  log.push({ok:true,t:t(),html:`📨 Case <b>${m.id}</b> auto-routed to <b>${m.center}</b> & Central Control Room`});
  avail.forEach(a=>{
    a.v.status="Engaged"; a.v.assigned=m.id;
    log.push({ok:true,t:t(),html:`✅ SMS + app alert → volunteer <b>${a.v.name}</b> (${a.v.id}, ${Math.round(a.d)} m) — <i>${a.v.skills[0]}</i>, dispatched to ${m.loc}`});
  });
  if(!avail.length)log.push({ok:false,t:t(),html:`⏳ No volunteer free nearby — escalated to zone marshal`});
  log.push({ok:true,t:t(),html:`🚓 Alert → <b>${ps.o.name}</b> (${km(ps.d)} km) · est. ${responseEst(ps.d).drive} min`});
  log.push({ok:true,t:t(),html:`🎥 CCTV watch enabled on ${cams.map(c=>c.o.id).join(", ")} (YOLO match profile pushed)`});
  DISPATCHES[m.id]=log;
  refreshVolunteerLayer();
  // auto-arm YOLO watch for this case
  WATCH.add(m.id);
}
function renderDispEntry(e){
  return `<div class="disp ${e.ok?"":"pending"}"><span>${e.html}</span><span class="t">${e.t}</span></div>`;
}
function nowTime(){const d=new Date();const p=n=>String(n).padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;}

/* ===================================================================
   YOLO  CCTV auto-flagging (simulated detection engine)
   =================================================================== */
let YOLO_ON=false, yoloTimer=null, DETS=[];
const WATCH=new Set();           // case ids under active CCTV watch
const DET_ATTRS={
  "saffron":"saffron kurta","green saree":"green saree","white clothes":"white dhoti",
  "rudraksha":"rudraksha mala","tilak":"forehead tilak","school":"school uniform",
  "child":"minor + guardian?","bald":"bald elderly male","grey":"grey-haired senior",
  "silk":"silk saree","bindi":"red bindi","pigtails":"child, pigtails"};
function attrsFor(m){
  const d=(m.desc||"").toLowerCase();const out=[];
  for(const k in DET_ATTRS)if(d.includes(k))out.push(DET_ATTRS[k]);
  if(!out.length)out.push(m.age.includes("0-12")||m.age.includes("13")?"minor":"adult, "+m.gender.toLowerCase());
  return out.slice(0,2).join(", ");
}
function yoloBtnLabel(){
  const btn=document.getElementById("btn-yolo");
  if(btn)btn.textContent=`🎥 ${t("yolo")}: ${YOLO_ON?t("on"):t("off")}`;
}
function initYolo(){
  const btn=document.getElementById("btn-yolo"),panel=document.getElementById("yoloPanel");
  yoloBtnLabel();
  btn.onclick=()=>{YOLO_ON=!YOLO_ON;
    btn.classList.toggle("on",YOLO_ON);
    yoloBtnLabel();
    panel.classList.toggle("show",YOLO_ON);
    document.getElementById("yoloStat").textContent=YOLO_ON?"LIVE":"PAUSED";
    document.getElementById("yoloStat").classList.toggle("live",YOLO_ON);
    if(YOLO_ON){yoloTimer=setInterval(yoloTick,2600); yoloTick();}
    else clearInterval(yoloTimer);
  };
  document.getElementById("yoloClose").onclick=()=>btn.onclick();
}
function yoloPool(){
  // prefer watched cases, else any open case
  let pool=DATA.missing.filter(m=>WATCH.has(m.id));
  if(pool.length<3)pool=pool.concat(DATA.missing.filter(m=>["Unresolved","Pending"].includes(m.status)));
  return pool;
}
function yoloTick(){
  const pool=yoloPool(); if(!pool.length)return;
  const m=pool[Math.floor(Math.random()*pool.length)];
  const cams=recommendCameras(m);
  const cam=cams[Math.floor(Math.random()*cams.length)].o;
  const watched=WATCH.has(m.id);
  const conf=Math.round((watched?72:55)+Math.random()*(watched?27:30));
  const det={id:"D"+(DETS.length+1),cam,m,conf,attrs:attrsFor(m),t:nowTime(),hi:conf>=80};
  DETS.unshift(det); if(DETS.length>40)DETS.pop();
  renderYoloFeed();
  flashCamera(cam,det.hi);
}
function renderYoloFeed(){
  const feed=document.getElementById("yoloFeed");
  feed.innerHTML=DETS.slice(0,25).map(d=>`
    <div class="det ${d.hi?"hi":""}">
      <div class="dh"><span class="cam">📷 ${d.cam.id}</span>
        <span class="conf ${d.hi?"hi":"lo"}">${d.conf}%</span></div>
      <div class="attrs">Detected: ${d.attrs} · possible match to <b>${d.m.name}</b> (${d.m.id})</div>
      <div class="acts">
        <button class="rev" onclick="reviewDet('${d.m.id}',${d.cam.lat},${d.cam.lng})">Review</button>
        <button onclick="this.closest('.det').style.opacity=.4">Dismiss</button></div>
    </div>`).join("");
}
window.reviewDet=(id,lat,lng)=>{selectCase(id);map.flyTo([lat,lng],17,{duration:.6});};
let flashLayer;
function flashCamera(cam,hi){
  if(!flashLayer)flashLayer=L_.layerGroup().addTo(map);
  const c=L_.circleMarker([cam.lat,cam.lng],{radius:6,color:hi?"#c62330":"#e0a93a",weight:2,
    fillColor:hi?"#ff5a6e":"#ffcf66",fillOpacity:.9});
  c.addTo(flashLayer);
  let r=6,grow=true,n=0;
  const iv=setInterval(()=>{r+=grow?2:-2;if(r>16)grow=false;if(r<6)grow=true;
    c.setRadius(r);if(++n>14){clearInterval(iv);flashLayer.removeLayer(c);}},90);
}

/* ===================================================================
   POLICE VEHICLE ROUTING  (real road network via OSRM) + animation
   The KML/CSV have no road graph, so we route over OSM streets through
   the public OSRM server, then drive a car marker along the geometry.
   =================================================================== */
const ROUTECACHE={};
async function osrmRoute(from,to){
  const url=`https://router.project-osrm.org/route/v1/driving/`+
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res=await fetch(url);
  const j=await res.json();
  if(j.code!=="Ok"||!j.routes.length)throw new Error(j.code||"no route");
  const r=j.routes[0];
  return {coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),  // [lat,lng]
          distance:r.distance, duration:r.duration};
}

async function dispatchVehicle(m,forceReplay){
  const ps=nearest(m.lat,m.lng,DATA.police,1)[0];
  const dEl=document.getElementById("vehDist"), eEl=document.getElementById("vehEta");
  const setTxt=(d,e)=>{if(dEl)dEl.textContent=d;if(eEl)eEl.innerHTML=e;};
  try{
    let rt=ROUTECACHE[m.id];
    if(!rt){
      if(dEl)dEl.textContent="routing along roads…";
      rt=await osrmRoute({lat:ps.o.lat,lng:ps.o.lng},{lat:m.lat,lng:m.lng});
      ROUTECACHE[m.id]=rt;
    }
    if(state.sel!==m.id && !forceReplay)return;   // user moved on while awaiting
    setTxt(`${km(rt.distance)} km`,
           `<b style="color:#0b3d91">~${Math.max(1,Math.round(rt.duration/60))} min</b> (free-flow road)`);
    playVehicle(rt.coords, ps.o.name, m.loc);
  }catch(err){
    // offline / blocked -> honest straight-line fallback
    setTxt(`${km(ps.d)} km (direct)`,
           `~${responseEst(ps.d).drive} min · <span style="color:#b8730a">road routing offline</span>`);
    playVehicle([[ps.o.lat,ps.o.lng],[m.lat,m.lng]], ps.o.name, m.loc);
  }
}

let vehLayer, vehAnim;
function clearVehicle(){
  if(vehAnim)cancelAnimationFrame(vehAnim);
  if(vehLayer)map.removeLayer(vehLayer);
  vehLayer=null;
}
function playVehicle(coords, fromName, toName){
  clearVehicle();
  vehLayer=L_.layerGroup().addTo(map);
  // route casing + bright line
  L_.polyline(coords,{color:"#0b3d91",weight:6,opacity:.85,lineCap:"round"}).addTo(vehLayer);
  L_.polyline(coords,{color:"#7fb0ff",weight:2.5,opacity:.95,dashArray:"1 12"}).addTo(vehLayer);
  // station + destination pins
  L_.marker(coords[0],{icon:emoji("🏢"),zIndexOffset:900})
    .bindTooltip(fromName,{direction:"top"}).addTo(vehLayer);
  L_.marker(coords[coords.length-1],{icon:emoji("📍"),zIndexOffset:900})
    .bindTooltip(toName,{direction:"top"}).addTo(vehLayer);
  // moving car
  const car=L_.marker(coords[0],{zIndexOffset:2000,
    icon:L_.divIcon({className:"",iconSize:[28,28],iconAnchor:[14,14],
      html:'<div style="font-size:22px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">🚓</div>'})}).addTo(vehLayer);
  // segment lengths for constant-speed interpolation
  const seg=[];let total=0;
  for(let i=1;i<coords.length;i++){const d=hav(coords[i-1][0],coords[i-1][1],coords[i][0],coords[i][1]);
    seg.push(d);total+=d;}
  if(total<1){return;}
  const playMs=Math.min(11000,Math.max(4500,total*4)); // scale visual speed to route length
  let start=null;
  function frame(ts){
    if(start===null)start=ts;
    const p=Math.min(1,(ts-start)/playMs), target=p*total;
    let acc=0,i=0;
    while(i<seg.length-1 && acc+seg[i]<target){acc+=seg[i];i++;}
    const a=coords[i], b=coords[Math.min(i+1,coords.length-1)];
    const frac=seg[i]?(target-acc)/seg[i]:0;
    car.setLatLng([a[0]+(b[0]-a[0])*frac, a[1]+(b[1]-a[1])*frac]);
    if(p<1)vehAnim=requestAnimationFrame(frame);
    else{car.setLatLng(coords[coords.length-1]);
      car.bindTooltip("Unit arrived ✓",{permanent:true,direction:"top"}).openTooltip();}
  }
  vehAnim=requestAnimationFrame(frame);
}
