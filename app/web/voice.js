/* Voice agent for report intake — built on the browser Web Speech API.
   Speech-to-text (SpeechRecognition) + text-to-speech (speechSynthesis) in the
   user's selected language (en/hi/mr/gu/ta). No backend or API key needed.
   Chrome / Edge support all five Indian locales; Firefox lacks recognition. */
(function(){
const BCP={en:"en-IN",hi:"hi-IN",mr:"mr-IN",gu:"gu-IN",ta:"ta-IN"};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let rec=null, aborted=false;

function lang(){return (window.kpLang?window.kpLang():"en");}
function tag(){return BCP[lang()]||"en-IN";}
function supported(){return !!SR;}

// ---- text to speech ----
function speak(text){
  return new Promise(res=>{
    if(!("speechSynthesis" in window)){res();return;}
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang=tag(); u.rate=0.96;
      const vs=speechSynthesis.getVoices();
      const v=vs.find(v=>v.lang===tag())||vs.find(v=>v.lang&&v.lang.slice(0,2)===lang());
      if(v)u.voice=v;
      let done=false; const finish=()=>{if(!done){done=true;res();}};
      u.onend=finish; u.onerror=finish;
      speechSynthesis.speak(u);
      setTimeout(finish, Math.min(9000, 1400+text.length*55)); // safety
    }catch(e){res();}
  });
}

// ---- speech to text (one utterance) ----
function listen(onInterim){
  return new Promise((resolve,reject)=>{
    if(!SR){reject(new Error("unsupported"));return;}
    rec=new SR();
    rec.lang=tag(); rec.interimResults=true; rec.maxAlternatives=1; rec.continuous=false;
    let finalTxt="";
    rec.onresult=e=>{
      let txt="";
      for(let i=0;i<e.results.length;i++) txt+=e.results[i][0].transcript;
      finalTxt=txt; if(onInterim)onInterim(txt);
    };
    rec.onerror=e=>{ if(e.error==="no-speech"||e.error==="aborted"){resolve(finalTxt.trim());} else reject(new Error(e.error)); };
    rec.onend=()=>{ rec=null; resolve(finalTxt.trim()); };
    try{rec.start();}catch(e){reject(e);}
  });
}
function stop(){
  aborted=true;
  try{if(rec)rec.stop();}catch(e){}
  try{speechSynthesis.cancel();}catch(e){}
}
function resetAbort(){aborted=false;}
function isAborted(){return aborted;}

// ---- parsers: spoken answer -> form value ----
function parseAge(t){
  const m=(t||"").match(/\d{1,3}/);
  let n=m?parseInt(m[0],10):null;
  if(n===null && /child|baby|kid|infant|बच्च|शिशु|मुल|बाळ|બાળ|குழந்த|சிறுவ/i.test(t)) n=8;
  if(n===null) return null;
  return n<=12?"0-12":n<=17?"13-17":n<=40?"18-40":n<=60?"41-60":n<=70?"61-70":n<=80?"71-80":"80+";
}
const MALE=["male","man","boy","gent","पुरुष","पुरूष","आदमी","लड़का","मुलगा","છોકરો","પુરુષ","ஆண்","பையன்","ஆண்மகன்"];
const FEMALE=["female","woman","girl","lady","महिला","औरत","लड़की","स्त्री","बाई","मुलगी","સ્ત્રી","મહિલા","છોકરી","பெண்","பெண்மணி","மகள்"];
function parseGender(t){
  const s=(t||"").toLowerCase();
  if(FEMALE.some(w=>s.includes(w.toLowerCase()))) return "Female";
  if(MALE.some(w=>s.includes(w.toLowerCase()))) return "Male";
  return null;
}
// fuzzy-match spoken text to one of the known location option strings
function matchLocation(t, options){
  const s=(t||"").toLowerCase();
  let best=null, score=0;
  options.forEach(o=>{
    const ol=o.toLowerCase();
    let sc=0;
    if(s.includes(ol)) sc=ol.length;
    else ol.split(/\s+/).forEach(w=>{ if(w.length>3 && s.includes(w)) sc+=w.length; });
    if(sc>score){score=sc;best=o;}
  });
  return score>0?best:null;
}

window.KPVoice={supported,tag,lang,speak,listen,stop,resetAbort,isAborted,parseAge,parseGender,matchLocation};
})();
