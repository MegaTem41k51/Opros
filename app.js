let streamers=[],current=null,currentIndex=null,qi=0,score=0,locked=false,me=null,combo=0,globalStats=null;
const $=id=>document.getElementById(id);
const funFacts=["Каждый новый проход меняет общую статистику.","Кто-то прямо сейчас пытается выбить идеальный результат.","67 — секретный админский ID.","10/10 — режим босса.","Смотри внимательнее: один ник может решить весь вопрос.","БЛИЦ не про скорость. БЛИЦ про то, насколько ты шаришь."];
let factIndex=0;
async function api(url,opts){const r=await fetch(url,opts);let data={};try{data=await r.json()}catch{}if(!r.ok){const e=new Error(data.error||"Ошибка");e.status=r.status;throw e}return data}
async function init(){
  try{streamers=await api("/api/streamers")}catch{streamers=[]}
  renderCards();
  try{globalStats=await api("/api/stats");renderGlobalStats(globalStats)}catch{}
  me=await api("/api/me");if(me.authorized)setLogged(me);else renderStats(null);
  nextFunFact();
}
function setLogged(data){me=data;$('authArea').innerHTML=`<div class="user">ID: <b>${data.id}</b>${data.admin?` · <a href="/admin.html">Админка</a>`:""} · <button class="authBtn small" onclick="logout()">Выйти</button></div>`;renderStats(data)}
function renderCards(){
  $('cards').innerHTML=streamers.length?streamers.map((s,i)=>`<article class="card effect-${effectClass(s.name)}" onclick="startQuiz(${i})"><div class="cardNumber">0${i+1}</div><div class="cardGlow"></div><div class="avatarRing"><img src="${s.image}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'"></div><div class="cardMeta"><h3>${esc(s.name)}</h3><small>${s.questions.length} вопросов</small></div><div class="cardArrow">↗</div></article>`).join(""):`<div class="empty">Сейчас нет доступных стримеров.</div>`;
}
function renderGlobalStats(g){
  if(!g)return;
  $('heroPlayers').textContent=g.players??0;$('heroAttempts').textContent=g.attempts??0;$('heroCorrect').textContent=g.correct??0;
  const top=(g.topPlayers||[]).slice(0,5), streams=(g.streamers||[]).slice(0,5);
  $('statsPanel').innerHTML=`<div class="statsHeader"><div><span>GLOBAL</span><h3>СТАТИСТИКА</h3></div><i>LIVE</i></div><div class="globalNumbers"><div><b>${g.players}</b><span>игроков</span></div><div><b>${g.attempts}</b><span>проходов</span></div><div><b>${g.correct}</b><span>верных</span></div></div><div class="statsBlock"><div class="blockTitle">ТОП ИГРОКОВ</div>${top.length?top.map((p,n)=>`<div class="leader"><span class="rank">${String(n+1).padStart(2,'0')}</span><b>ID ${p.id}</b><span>${p.correct}✓</span></div>`).join(''):`<div class="statsEmpty">Пока пусто — будь первым.</div>`}</div><div class="statsBlock"><div class="blockTitle">СТРИМЕРЫ</div>${streams.length?streams.map(s=>`<div class="leader"><span class="dot"></span><b>${esc(s.name)}</b><span>${s.attempts}×</span></div>`).join(''):`<div class="statsEmpty">Нет данных.</div>`}</div>`;
}
function renderStats(data){
  // The sidebar is GLOBAL by design; the current user's data is shown only after a completed test.
  if(globalStats)renderGlobalStats(globalStats);
}
function openAuth(){$('authModal').classList.remove('hidden');$('idInput').focus()}
function closeAuth(){$('authModal').classList.add('hidden');$('idError').textContent=""}
async function login(){const value=$('idInput').value.trim();$('idError').textContent="";if(!/^\d+$/.test(value)){ $('idError').textContent="Введите ID";return }const id=Number(value);if(id<0||id>100000){$('idError').textContent="Неверный ID";return}try{const data=await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:value})});closeAuth();setLogged(data)}catch(e){$('idError').textContent=e.status===409?'Уже есть такой ID':'Ошибка авторизации'}}
async function logout(){await api('/api/logout',{method:'POST'});location.reload()}
async function startQuiz(i){const data=await api('/api/me');if(!data.authorized){openAuth();return}me=data;current=streamers[i];currentIndex=current.index;qi=0;score=0;combo=0;$('home').classList.add('hidden');$('result').classList.add('hidden');$('quiz').classList.add('hidden');playIntro(current,()=>{$('quiz').classList.remove('hidden');$('quizImg').src=current.image;$('quizName').textContent=current.name;$('qTotal').textContent=current.questions.length;showQuestion()})}
function showQuestion(){locked=false;const q=current.questions[qi];$('qNum').textContent=String(qi+1).padStart(2,'0');$('question').textContent=q.q;$('answers').innerHTML=q.answers.map((a,i)=>`<button class="answer" onclick="answer(${i})"><span>${String.fromCharCode(65+i)}</span>${esc(a)}</button>`).join('');$('progress').style.width=((qi)/current.questions.length*100)+'%';$('streak').textContent=`COMBO ×${combo}`}
function answer(i){if(locked)return;locked=true;const q=current.questions[qi],buttons=[...document.querySelectorAll('.answer')];buttons.forEach(b=>b.disabled=true);if(i===q.correct){score++;combo++;buttons[i].classList.add('correct');popText('CORRECT +1')}else{combo=0;buttons[i].classList.add('wrong');buttons[q.correct]?.classList.add('correct');popText('Мимо')}setTimeout(()=>{qi++;if(qi>=current.questions.length)finish();else showQuestion()},480)}
async function finish(){
  $('quiz').classList.add('hidden');playOutro(current,()=>{$('result').classList.remove('hidden');$('score').textContent=`${score}/${current.questions.length}`;$('resultPhrase').textContent=getResultPhrase(score,current.questions.length);$('resultText').textContent=`Ты прошёл ${current.name}. Результат уже улетел в общую статистику.`;fireConfetti(score===current.questions.length)});
  try{const data=await api('/api/attempt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({correct:score,total:current.questions.length,streamerIndex:currentIndex})});if(data.global){globalStats=data.global;renderGlobalStats(globalStats)}}catch{}
}
function getResultPhrase(n,total){if(n===total)return 'ТЫ КРАСАВА ТЫ ЗНАЕШЬ НИК СТРИМЕРА КАК РОДНОГО БРАТА';return ({1:'ЧЕЛ ТЫ ВООБЩЕ НЕ ШАРИШЬ',2:'БРО ТЕБЕ НАДО ТРЕНИРОВАТЬСЯ',3:'ПАЦАН ТЫ СТАНОВИШЬСЯ ЛУЧШЕ',4:'НУУ.. ПОЙДЕТ',5:'УЧИСЬ СТУДЕНТ',6:'ДАЛЬШЕ — БОЛЬШЕ',7:'Я УВЕРЕН ЧТО ТЫ СТАЛ БОЛЬШЕ ИХ СМОТРЕТЬ',8:'НЕМНОГО ДОСМОТРИ И БУДЕТ 10/10',9:'НУ ТЫ ИДЕШЬ НА ФИНИШНУЮ ПРЯМУЮ БРАТАН',0:'ПОКА ТЫ ЕЩЁ РАЗМИНАЕШЬСЯ — ПОПРОБУЙ ЕЩЁ РАЗ'})[n]||'НЕПЛОХО. ЕЩЁ ОДИН ЗАБЕГ?'}
function replayCurrent(){startQuiz(streamers.findIndex(s=>s.index===currentIndex))}
function playIntro(s,done){const o=$('fxOverlay');o.className=`fxOverlay show intro effect-${effectClass(s.name)}`;o.innerHTML=`<div class="fxGrid"></div><div class="fxAvatar"><img src="${s.image}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'"></div><div class="fxSmall">БЛИЦ / 00${current.questions.length}</div><div class="fxName">${esc(s.name)}</div><div class="fxLabel">ГОТОВ?</div>`;setTimeout(()=>{o.classList.remove('show');setTimeout(done,260)},1350)}
function playOutro(s,done){const o=$('fxOverlay');o.className=`fxOverlay show outro effect-${effectClass(s.name)}`;o.innerHTML=`<div class="fxGrid"></div><div class="fxLabel">РЕЗУЛЬТАТ</div><div class="fxName">${esc(s.name)}</div><div class="fxScore">${score}/${current.questions.length}</div><div class="fxResultLine">${esc(getResultPhrase(score,current.questions.length))}</div>`;setTimeout(()=>{o.classList.remove('show');setTimeout(done,260)},1500)}
function effectClass(name){return ({megarush51:'mega',mmr9i9:'glitch',m4ga:'rings',realykekss:'diamonds',emilshe1nru:'night',j05k1y:'speed',del1ght:'shock'})[String(name).toLowerCase()]||'default'}
function goHome(){$('quiz').classList.add('hidden');$('result').classList.add('hidden');$('home').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})}
function nextFunFact(){factIndex=(factIndex+1)%funFacts.length;$('funFact').textContent=funFacts[factIndex]}
function popText(t){const p=document.createElement('div');p.className='popText';p.textContent=t;document.body.appendChild(p);setTimeout(()=>p.remove(),650)}
function fireConfetti(perfect){const n=perfect?80:24;for(let i=0;i<n;i++){const x=document.createElement('i');x.className='confetti';x.style.left=Math.random()*100+'vw';x.style.animationDelay=Math.random()*.25+'s';x.style.setProperty('--r',(Math.random()*720-360)+'deg');document.body.appendChild(x);setTimeout(()=>x.remove(),1800)}}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
init();
