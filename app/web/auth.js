/* Staff login — authenticates SERVER-SIDE (Flask).
   No credentials or roles are trusted from the client; the server sets a
   signed-cookie session and enforces what data each role can read. */
let ROLE="admin";

document.querySelectorAll(".role").forEach(r=>r.addEventListener("click",()=>{
  document.querySelectorAll(".role").forEach(x=>x.classList.remove("on"));
  r.classList.add("on"); ROLE=r.dataset.role;
  document.getElementById("uid").value=ROLE; // convenience for demo
}));

async function doLogin(){
  const pwd=document.getElementById("pwd").value;
  const err=document.getElementById("err");
  err.classList.remove("show");
  try{
    const res=await fetch("/api/login",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({role:ROLE, password:pwd})
    });
    const j=await res.json();
    if(!res.ok||!j.ok){
      err.textContent=(window.t?t("lg_err"):"Invalid role / access code.");
      err.classList.add("show"); return;
    }
    location.href="portal.html";
  }catch(e){
    err.textContent=(window.t?t("lg_unreach"):"Server unreachable — start with RUN.bat.");
    err.classList.add("show");
  }
}
