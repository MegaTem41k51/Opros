let streamers=[],current=null,qi=0,score=0,locked=false;
const $=id=>document.getElementById(id);

async function api(url,opts){
  const r=await fetch(url,opts);
  let data={};try{data=await r.json()}catch{}
  if(!r.ok){const e=new Error(data.error||"Ошибка");e.status=r.status;throw e}
  return data;
}

async function init(){
  streamers=await api("/api/streamers");
  renderCards();
  const me=await api("/api/me");
  if(me.authorized) setLogged(me);
}

function setLogged(me){
  $("authArea").innerHTML=
    `<div class="user">ID: <b>${me.id}</b>${me.admin?` · <a href="/admin.html" style="color:#c397ff">Админка</a>`:""} · <button class="authBtn small" onclick="logout()">Выйти</button></div>`;
}

function renderCards(){
  $("cards").innerHTML=streamers.map((s,i)=>
    `<article class="card" onclick="startQuiz(${i})">
      <img src="${s.image}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'">
      <h3>${esc(s.name)}</h3><small>${s.questions.length} вопросов</small>
    </article>`).join("");
}

function openAuth(){
  $("authModal").classList.remove("hidden");
  $("idInput").focus();
}
function closeAuth(){
  $("authModal").classList.add("hidden");
  $("idError").textContent="";
}
async function login(){
  const value=$("idInput").value.trim();
  $("idError").textContent="";
  if(!/^\d+$/.test(value)){ $("idError").textContent="Введите ID"; return; }
  const id=Number(value);
  if(id<0||id>100000){ $("idError").textContent="Неверный ID"; return; }

  try{
    const me=await api("/api/login",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:value})
    });
    closeAuth();
    setLogged(me);
  }catch(e){
    $("idError").textContent=e.status===409?"Уже есть такой ID":"Ошибка авторизации";
  }
}

async function logout(){
  await api("/api/logout",{method:"POST"});
  location.reload();
}

async function startQuiz(i){
  const me=await api("/api/me");
  if(!me.authorized){
    openAuth();
    return;
  }
  current=streamers[i];qi=0;score=0;
  $("home").classList.add("hidden");
  $("result").classList.add("hidden");
  $("quiz").classList.remove("hidden");
  $("quizImg").src=current.image;
  $("quizName").textContent=current.name;
  showQuestion();
}

function showQuestion(){
  locked=false;
  const q=current.questions[qi];
  $("question").textContent=q.q;
  $("answers").innerHTML=q.answers.map((a,i)=>
    `<button class="answer" onclick="answer(${i})">${esc(a)}</button>`).join("");
  $("progress").style.width=(qi/current.questions.length*100)+"%";
}

async function answer(i){
  if(locked)return;
  locked=true;
  const q=current.questions[qi];
  if(i===q.correct)score++;
  document.querySelectorAll(".answer").forEach(b=>b.disabled=true);
  setTimeout(()=>{
    qi++;
    if(qi>=current.questions.length) finish();
    else showQuestion();
  },250);
}

async function finish(){
  $("quiz").classList.add("hidden");
  $("result").classList.remove("hidden");
  $("score").textContent=`${score}/${current.questions.length}`;
  $("resultText").textContent="Результат сохранён в статистике.";
  try{
    await api("/api/attempt",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({correct:score,total:current.questions.length})
    });
  }catch{}
}

function goHome(){
  $("quiz").classList.add("hidden");
  $("result").classList.add("hidden");
  $("home").classList.remove("hidden");
}
function esc(s){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}
init();