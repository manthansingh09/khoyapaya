/* Role-gated case register: searchable, filterable, scrollable table.
   Auth + field-level access control are enforced SERVER-SIDE:
   we fetch /api/session and /api/cases; the server has already removed any
   fields this role may not see, so the client only renders what it received. */

let AUTH=null, ROLE="volunteer";

// column catalogue — a column is shown only if the role is allowed AND the
// server actually returned that field (defensive: server is the source of truth)
const COLUMNS=[
  {key:"id",    label:"Case ID"},
  {key:"name",  label:"Name"},
  {key:"gender",label:"Gender"},
  {key:"age",   label:"Age band"},
  {key:"status",label:"Status", badge:true},
  {key:"loc",   label:"Last seen"},
  {key:"zone",  label:"Zone"},
  {key:"ts",    label:"Reported at"},
  {key:"lang",  label:"Language"},
  {key:"phone", label:"Reporter mobile"},
  {key:"home",  label:"Home (district, state)"},
  {key:"desc",  label:"Description", cls:"desc"},
  {key:"center",label:"Reporting center"},
  {key:"resolution",label:"Resolution (hrs)"},
  {key:"remarks",label:"Remarks", cls:"remarks"},
  {key:"dup",   label:"Duplicate?", bool:true},
];
let PRESENT=new Set();                    // keys actually present in the payload
function visibleCols(){return COLUMNS.filter(c=>PRESENT.has(c.key));}
function cellValue(c,row){
  if(c.bool) return row[c.key]?"Yes":"—";
  let v=row[c.key]; if(v===undefined||v==="") v="—";
  if(c.badge){const s=String(v).split(" ")[0];return `<span class="badge b-${s}">${v}</span>`;}
  return escapeHtml(String(v));
}
function escapeHtml(s){return s.replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));}

let ROWS=[], view=[], sortKey="ts", sortDir=-1;

// ---- boot: verify session, then pull role-filtered cases ----
(async function(){
  try{
    const s=await fetch("/api/session");
    if(!s.ok){location.href="login.html";return;}
    AUTH=await s.json(); ROLE=AUTH.role;
    const c=await fetch("/api/cases");
    if(!c.ok){location.href="login.html";return;}
    const j=await c.json();
    ROWS=j.cases;
    PRESENT=new Set(ROWS.length?Object.keys(ROWS[0]):[]);
    boot();
  }catch(e){
    document.getElementById("tbody").innerHTML=
      `<tr><td class="empty-row">Server unreachable — launch with RUN.bat (Flask). ${e}</td></tr>`;
  }
})();

function boot(){
  const icon={admin:"🛡️",police:"🚓",volunteer:"🧑‍🤝‍🧑"}[ROLE]||"👤";
  document.getElementById("roleChip").innerHTML=
    `${icon} ${AUTH.name} · <b>${ROLE.toUpperCase()}</b> <span class="lo" id="logout">${t("logout")}</span>`;
  document.getElementById("who").textContent=`Signed in as ${ROLE} · ${AUTH.name}`;
  document.getElementById("logout").onclick=async()=>{
    try{await fetch("/api/logout",{method:"POST"});}catch(e){}
    location.href="login.html";
  };
  if(ROLE!=="admin")document.getElementById("export").style.display="none";

  buildFilters(); buildHead();
  ["q","f-status","f-age","f-gender","f-loc","f-zone"].forEach(id=>
    document.getElementById(id).addEventListener("input",apply));
  document.getElementById("clear").onclick=()=>{
    document.getElementById("q").value="";
    ["f-status","f-age","f-gender","f-loc","f-zone"].forEach(id=>document.getElementById(id).value="All");
    apply();
  };
  document.getElementById("export").onclick=exportCsv;
  // re-translate headers / filters / chip / rows on language change
  document.addEventListener("kp:lang",()=>{
    buildHead();
    document.querySelectorAll(".ptoolbar select").forEach(sel=>{
      const o=sel.querySelector('option[value="All"]'); if(o)o.textContent=t("all");
    });
    const lo=document.getElementById("logout"); if(lo)lo.textContent=t("logout");
    render();
  });
  apply();
}

function uniq(f){return [...new Set(ROWS.map(f))].filter(Boolean).sort();}
function fill(id,opts){document.getElementById(id).innerHTML=opts.map(o=>
  o==="All"?`<option value="All">${window.t?t("all"):"All"}</option>`:`<option>${o}</option>`).join("");}
function buildFilters(){
  fill("f-status",["All",...uniq(r=>r.status)]);
  fill("f-age",["All",...uniq(r=>r.age)]);
  fill("f-gender",["All",...uniq(r=>r.gender)]);
  fill("f-loc",["All",...uniq(r=>r.loc)]);
  fill("f-zone",["All",...uniq(r=>r.zone)]);
}
function colLabel(c){return (window.t?t("col_"+c.key):c.label)||c.label;}
function buildHead(){
  document.getElementById("thead").innerHTML="<tr>"+visibleCols().map(c=>
    `<th data-k="${c.key}">${colLabel(c)}<span class="ar">${sortKey===c.key?(sortDir>0?"▲":"▼"):"⇅"}</span></th>`
  ).join("")+"</tr>";
  document.querySelectorAll("#thead th").forEach(th=>th.onclick=()=>{
    const k=th.dataset.k;
    if(sortKey===k)sortDir*=-1; else{sortKey=k;sortDir=1;}
    buildHead(); render();
  });
}

const val=id=>document.getElementById(id).value;
function apply(){
  const q=val("q").toLowerCase().trim();
  const st=val("f-status"),ag=val("f-age"),ge=val("f-gender"),lo=val("f-loc"),zo=val("f-zone");
  const cols=visibleCols();
  view=ROWS.filter(r=>{
    if(st!=="All"&&r.status!==st)return false;
    if(ag!=="All"&&r.age!==ag)return false;
    if(ge!=="All"&&r.gender!==ge)return false;
    if(lo!=="All"&&r.loc!==lo)return false;
    if(zo!=="All"&&r.zone!==zo)return false;
    if(q){
      const hay=cols.map(c=>String(r[c.key]??"")).join(" ").toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });
  render();
}

function render(){
  const cols=visibleCols();
  view.sort((a,b)=>{
    let x=a[sortKey],y=b[sortKey];
    const nx=parseFloat(x),ny=parseFloat(y);
    if(!isNaN(nx)&&!isNaN(ny)){x=nx;y=ny;}else{x=String(x).toLowerCase();y=String(y).toLowerCase();}
    return x<y?-sortDir:x>y?sortDir:0;
  });
  document.getElementById("count").textContent=
    `${view.length.toLocaleString()} ${t("of")} ${ROWS.length.toLocaleString()} ${t("cases_word")}`;
  const tb=document.getElementById("tbody");
  if(!view.length){tb.innerHTML=`<tr><td class="empty-row" colspan="${cols.length}">${t("no_cases")}</td></tr>`;return;}
  tb.innerHTML=view.map(r=>"<tr>"+cols.map(c=>
    `<td class="${c.cls||""}">${cellValue(c,r)}</td>`).join("")+"</tr>").join("");
}

function exportCsv(){
  const cols=visibleCols();
  const head=cols.map(c=>c.label).join(",");
  const lines=view.map(r=>cols.map(c=>{
    let v=(c.bool?(r[c.key]?"Yes":"No"):r[c.key]??"");
    v=String(v).replace(/"/g,'""');
    return /[",\n]/.test(v)?`"${v}"`:v;
  }).join(","));
  const blob=new Blob([head+"\n"+lines.join("\n")],{type:"text/csv"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`khoyapaya_cases_${ROLE}_${view.length}.csv`;
  a.click();URL.revokeObjectURL(a.href);
}
