let allEpisodes=[], watched=new Set(), username="";
const $=s=>document.querySelector(s);
async function api(url,opts={}){const r=await fetch(url,{headers:{"Content-Type":"application/json"},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"حدث خطأ.");return d}
function view(name){document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));$("#"+name).classList.remove("hidden");window.scrollTo(0,0)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(b)view(b.dataset.view)});
async function enter(){const me=await api("/api/me");username=me.username;$("#username").textContent=username;const p=await api("/api/progress");watched=new Set(p.watched);allEpisodes=await fetch("/episodes.json").then(r=>r.json()).catch(()=>[]);if(!allEpisodes.length)allEpisodes=window.EPISODES||[];render();view("dashboard")}
async function authForm(id,url,msgId){$(id).addEventListener("submit",async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));$(msgId).textContent="";try{await api(url,{method:"POST",body:JSON.stringify(data)});await enter()}catch(err){$(msgId).textContent=err.message}})}
authForm("#loginForm","/api/login","#loginMsg");authForm("#registerForm","/api/register","#registerMsg");
$("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});view("home")};
function updateProgress(){let n=watched.size,p=Math.round(n/339*100);$("#progressText").textContent=`${n} / 339 watched`;$("#progressBar").style.width=p+"%";$("#percent").textContent=p+"%"}
function showName(code){return ({TVD:"The Vampire Diaries",TO:"The Originals",LEG:"Legacies","Web Series":"Web Series"})[code]||code}
function render(){
 updateProgress();const q=$("#search").value.trim().toLowerCase(),f=$("#filter").value,s=$("#status").value;
 const filtered=allEpisodes.filter(x=>(f==="all"||x.show===f)&&(!q||x.title.toLowerCase().includes(q)||x.id.toLowerCase().includes(q))&&(s==="all"||(s==="watched"?watched.has(x.id):!watched.has(x.id))));
 $("#shownCount").textContent=`Showing ${filtered.length} of 339`;
 const list=$("#episodeList");list.innerHTML="";
 if(!filtered.length){list.innerHTML='<div class="empty">No episodes match your filters.</div>';return}
 let last="";
 filtered.forEach((x)=>{
   const group=x.show==="Web Series"?"Web Series":`${showName(x.show)} · Season ${x.season}`;
   if(group!==last){const h=document.createElement("div");h.className="group-title";h.textContent=group;list.appendChild(h);last=group}
   const row=document.createElement("label");row.className="episode"+(watched.has(x.id)?" done":"");
   const cb=document.createElement("input");cb.type="checkbox";cb.checked=watched.has(x.id);cb.setAttribute("aria-label","Mark watched");
   cb.addEventListener("change",async()=>{const state=cb.checked;try{await api("/api/progress/"+encodeURIComponent(x.id),{method:"PUT",body:JSON.stringify({watched:state})});state?watched.add(x.id):watched.delete(x.id);render()}catch(err){cb.checked=!state;alert(err.message)}});
   const num=document.createElement("span");num.className="epnum";num.textContent=String(allEpisodes.indexOf(x)+1).padStart(3,"0");
   const title=document.createElement("span");title.className="eptitle";title.textContent=x.title;
   row.append(cb,num,title);if(x.kind==="webisode"){const tag=document.createElement("span");tag.className="webtag";tag.textContent="WEB";row.append(tag)}list.append(row);
 });
}
["#search","#filter","#status"].forEach(id=>$(id).addEventListener(id==="#search"?"input":"change",render));
fetch("/episodes.json").then(r=>r.json()).then(x=>allEpisodes=x);
api("/api/me").then(()=>enter()).catch(()=>view("home"));
