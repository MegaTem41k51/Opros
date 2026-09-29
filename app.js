let streamers=[],current=null,currentIndex=null,qi=0,score=0,locked=false,me=null;
const $=id=>document.getElementById(id);

async function api(url,opts){
  const r=await fetch(url,opts);let data={};try{data=await r.json()}catch{}
  if(!r.ok){const e=new Error(data.error||"Ошибка");e.status=r.status;throw e}return data;
}

async function init(){
  streamers=await api("/api/streamers");
  renderCards();
  me=await api("/api/me");
  if(me.authorized){setLogged(me);renderStats(me)}else renderStats(null);
}

function setLogged(data){
  me=data;
  $("authArea").innerHTML=`<div class="user">ID: <b>${data.id}</b>${data.admin?` · <a href="/admin.html" style="color:#c397ff">Админка</a>`:""} · <button class="authBtn small" onclick="logout()">Выйти</button></div>`;
  renderStats(data);
}

function renderCards(){
  $("cards").innerHTML=streamers.length?streamers.map((s,i)=>`<article class="card effect-${effectClass(s.name)}" onclick="startQuiz(${i})">
    <div class="cardGlow"></div><img src="${s.image}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'">
    <h3>${esc(s.name)}</h3><small>${s.questions.length} вопросов</small>
  </article>`).join(""):"<div class='empty'>Сейчас нет доступных стримеров.</div>";
}

function renderStats(data){
  const box=$("statsPanel");
  if(!data||!data.authorized){box.innerHTML=`<div class="statsTitle">СТАТИСТИКА</div><div class="statsEmpty">Войди по ID, чтобы видеть свои проходы.</div>`;return;}
  const list=data.stats?.streamers||[];
  box.innerHTML=`<div class="statsTitle">СТАТИСТИКА</div><div class="statsUser">ID ${data.id}</div><div class="statsTotal"><b>${data.stats.attempts||0}</b><span>прохождений</span><b>${data.stats.correct||0}</b><span>правильных</span></div>
    <div class="statsList">${list.length?list.map(s=>`<div class="statRow ${s.hidden?'history':''}"><div><b>${esc(s.name)}</b>${s.hidden?'<small>скрыт</small>':''}</div><span>${s.attempts}×</span></div>`).join(""):"<div class='statsEmpty'>Проходов пока нет.</div>"}</div>`;
}

function openAuth(){$("authModal").classList.remove("hidden");$("idInput").focus()}
function closeAuth(){$("authModal").classList.add("hidden");$("idError").textContent=""}
async function login(){
  const value=$("idInput").value.trim();$("idError").textContent="";
  if(!/^\d+$/.test(value)){ $("idError").textContent="Введите ID";return }
  const id=Number(value);if(id<0||id>100000){$("idError").textContent="Неверный ID";return}
  try{const data=await api("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:value})});closeAuth();setLogged(data)}
  catch(e){$("idError").textContent=e.status===409?"Уже есть такой ID":"Ошибка авторизации"}
}
async function logout(){await api("/api/logout",{method:"POST"});location.reload()}

async function startQuiz(i){
  const data=await api("/api/me");
  if(!data.authorized){openAuth();return}
  current=streamers[i];currentIndex=current.index;qi=0;score=0;
  $("home").classList.add("hidden");$("result").classList.add("hidden");$("quiz").classList.add("hidden");
  playIntro(current,()=>{
    $("quiz").classList.remove("hidden");
    $("quizImg").src=current.image;$("quizName").textContent=current.name;showQuestion();
  });
}

function showQuestion(){
  locked=false;const q=current.questions[qi];$("question").textContent=q.q;
  $("answers").innerHTML=q.answers.map((a,i)=>`<button class="answer" onclick="answer(${i})">${esc(a)}</button>`).join("");
  $("progress").style.width=(qi/current.questions.length*100)+"%";
}

function answer(i){
  if(locked)return;locked=true;const q=current.questions[qi];if(i===q.correct)score++;
  document.querySelectorAll(".answer").forEach(b=>b.disabled=true);
  setTimeout(()=>{qi++;if(qi>=current.questions.length)finish();else showQuestion()},250);
}

async function finish(){
  $("quiz").classList.add("hidden");
  playOutro(current,()=>{
    $("result").classList.remove("hidden");$("score").textContent=`${score}/${current.questions.length}`;$("resultText").textContent="Результат сохранён в статистике.";
  });
  try{
    const data=await api("/api/attempt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({correct:score,total:current.questions.length,streamerIndex:currentIndex})});
    if(me){me.stats=data.stats||me.stats;const fresh=await api("/api/me");if(fresh.authorized){me=fresh;renderStats(fresh)}}
  }catch{}
}

function playIntro(s,done){
  const overlay=$("fxOverlay");overlay.className=`fxOverlay show intro effect-${effectClass(s.name)}`;
  overlay.innerHTML=`<div class="fxParticles"></div><div class="fxAvatar"><img src="${s.image}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'"></div><div class="fxSmall">БЛИЦ</div><div class="fxName">${esc(s.name)}</div><div class="fxLabel">ГОТОВ?</div>`;
  setTimeout(()=>{overlay.classList.remove("show");setTimeout(done,220)},1250);
}
function playOutro(s,done){
  const overlay=$("fxOverlay");overlay.className=`fxOverlay show outro effect-${effectClass(s.name)}`;
  overlay.innerHTML=`<div class="fxParticles"></div><div class="fxLabel">ТЕСТ ЗАВЕРШЁН</div><div class="fxName">${esc(s.name)}</div><div class="fxScore">${score}/${current.questions.length}</div>`;
  setTimeout(()=>{overlay.classList.remove("show");setTimeout(done,220)},1100);
}
function effectClass(name){return ({megarush51:"mega",mmr9i9:"glitch",m4ga:"rings",realykekss:"diamonds",emilshe1nru:"night",j05k1y:"speed",del1ght:"shock"})[String(name).toLowerCase()]||"default"}
function goHome(){$("quiz").classList.add("hidden");$("result").classList.add("hidden");$("home").classList.remove("hidden");renderStats(me)}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
init();
