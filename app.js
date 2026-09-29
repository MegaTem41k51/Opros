let streamers=[], current=null, qi=0, score=0, locked=false;
const $=id=>document.getElementById(id);
async function api(url,opts){const r=await fetch(url,opts); if(!r.ok) throw new Error("API"); return r.json();}
async function init(){const me=await api("/api/me"); $("uid").textContent=me.id; streamers=await api("/api/streamers"); renderCards();}
function renderCards(){ $("cards").innerHTML=streamers.map((s,i)=>`<article class="card" onclick="startQuiz(${i})"><img src="${s.image}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'"><h3>${esc(s.name)}</h3><small>${s.questions.length} вопросов</small></article>`).join("");}
function startQuiz(i){current=streamers[i];qi=0;score=0;$("home").classList.add("hidden");$("result").classList.add("hidden");$("quiz").classList.remove("hidden");$("quizImg").src=current.image;$("quizName").textContent=current.name;showQuestion();}
function showQuestion(){locked=false;const q=current.questions[qi];$("question").textContent=q.q;$("answers").innerHTML=q.answers.map((a,i)=>`<button class="answer" onclick="answer(${i})">${esc(a)}</button>`).join("");$("progress").style.width=(qi/current.questions.length*100)+"%";}
async function answer(i){if(locked)return;locked=true;const q=current.questions[qi];if(i===q.correct)score++;document.querySelectorAll(".answer").forEach(b=>b.disabled=true);setTimeout(()=>{qi++;if(qi>=current.questions.length)finish();else showQuestion()},250);}
async function finish(){ $("quiz").classList.add("hidden");$("result").classList.remove("hidden");$("score").textContent=`${score}/${current.questions.length}`;$("resultText").textContent=`Ты набрал ${score} из ${current.questions.length}. Результат сохранён только как анонимная статистика.`; try{await api("/api/attempt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({correct:score,total:current.questions.length})})}catch{}}
function goHome(){$("quiz").classList.add("hidden");$("result").classList.add("hidden");$("home").classList.remove("hidden");}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
init();
