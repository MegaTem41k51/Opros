let state=null;
async function load(){
  const r=await fetch("/api/admin");
  if(!r.ok){document.getElementById("err").textContent="Нет доступа. Войди на сайте с ID 67.";return}
  state=await r.json();
  document.getElementById("login").classList.add("hidden");
  document.getElementById("panel").classList.remove("hidden");
  render();
}
function render(){
  document.getElementById("editors").innerHTML=state.streamers.map((s,si)=>`<div class="editor"><h2>${si+1}. ${esc(s.name)}</h2><label>Название</label><input class="input" id="name-${si}" value="${esc(s.name)}"><label>URL картинки</label><input class="input" id="img-${si}" value="${esc(s.image)}"><div id="qs-${si}">${s.questions.map((q,qi)=>qhtml(si,qi,q)).join("")}</div><button onclick="addQ(${si})">+ Добавить вопрос</button> <button class="save" onclick="save(${si})">Сохранить</button></div>`).join("");
  document.getElementById("stats").innerHTML=state.users.length?state.users.map(u=>`<div class="stat"><b>ID ${u.id}</b> — прохождений: ${u.attempts}, правильных: ${u.correct}</div>`).join(""):"Пока нет пользователей.";
}
function qhtml(si,qi,q){return `<div class="q"><b>Вопрос ${qi+1}</b><input class="input qt-${si}" value="${esc(q.q)}"><div class="answers">${q.answers.map((a,ai)=>`<input class="input an-${si}-${qi}" data-ai="${ai}" value="${esc(a)}" placeholder="Ответ ${ai+1}">`).join("")}</div><select class="input cr-${si}">${q.answers.map((_,ai)=>`<option value="${ai}" ${ai===q.correct?"selected":""}>Правильный: ${ai+1}</option>`).join("")}</select><button class="danger" onclick="delQ(${si},${qi})">Удалить</button></div>`}
function addQ(si){state.streamers[si].questions.push({q:"Новый вопрос",answers:["Вариант 1","Вариант 2","Вариант 3","Вариант 4"],correct:0});render()}
function delQ(si,qi){state.streamers[si].questions.splice(qi,1);render()}
async function save(si){
  const els=[...document.querySelectorAll(`#qs-${si} .q`)];
  const questions=els.map((el,qi)=>({q:el.querySelector(`.qt-${si}`).value,answers:[...el.querySelectorAll(`.an-${si}-${qi}`)].map(x=>x.value),correct:Number(el.querySelector(`.cr-${si}`).value)}));
  const r=await fetch(`/api/admin/streamers/${si}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:document.getElementById(`name-${si}`).value,image:document.getElementById(`img-${si}`).value,questions})});
  if(r.ok){state=await(await fetch("/api/admin")).json();render();alert("Сохранено")}
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
load();