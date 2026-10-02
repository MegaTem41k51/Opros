let streamers=[],current=null,currentIndex=null,qi=0,score=0,locked=false,me=null,combo=0,globalStats=null,votingState=null;let resultPhotoTimer=null,resultPhotoIndex=0,audioStopTimer=null,audioPrimed=false;
const $=id=>document.getElementById(id);
const funFacts=["Каждый новый проход меняет общую статистику.","Кто-то прямо сейчас пытается выбить идеальный результат.","10/10 — режим босса.","Смотри внимательнее: один ник может решить весь вопрос.","БЛИЦ не про скорость. БЛИЦ про то, насколько ты шаришь.","Комбо растёт, когда ты не ошибаешься."];
let factIndex=0;
async function api(url,opts={}){opts={...opts,cache:"no-store"};const r=await fetch(url,opts);let data={};try{data=await r.json()}catch{}if(!r.ok){const e=new Error(data.error||"Ошибка");e.status=r.status;throw e}return data}
async function init(){
  try{streamers=await api("/api/streamers")}catch{streamers=[]}
  renderBrandAvatars();
  renderCards();
  try{votingState=await api("/api/voting");renderVoting()}catch{}
  try{globalStats=await api("/api/stats");renderGlobalStats(globalStats)}catch{}
  me=await api("/api/me");if(me.authorized)setLogged(me);else renderStats(null);
  nextFunFact();
}
function setLogged(data){me=data;const admin=data.admin?`<button class="authBtn small adminOnlyBtn" onclick="location.href='/admin-panel-OPROS.html'">Админ панель</button>`:'';$('authArea').innerHTML=`<div class="user">${admin}<span class="twitchUser">Игрок ${data.id}</span> · <button class="authBtn small" onclick="logout()">Выйти</button></div>`;renderStats(data);if(votingState)renderVoting()}
function renderBrandAvatars(){
  const box=$("brandAvatars");
  if(!box)return;
  box.innerHTML=streamers.slice(0,7).map((s,i)=>`<span class="brandAvatar ba-${i}"><img src="${esc(s.image)}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'"></span>`).join('');
}
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
function showHome(){$('voting').classList.add('hidden');$('quiz').classList.add('hidden');$('result').classList.add('hidden');$('home').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})}
async function showVoting(){try{votingState=await api('/api/voting');renderVoting()}catch(e){return alert(e.message)}$('home').classList.add('hidden');$('quiz').classList.add('hidden');$('result').classList.add('hidden');$('voting').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});playUiSound('nav')}
function renderVoting(){const v=votingState;if(!v)return;$('voteTitle').textContent=v.title||'Голосование';const status=$('voteStatus');if(!v.enabled){status.textContent='Голосования (В разработке)';status.className='voteStatus closed';}else if(v.voted){status.textContent=`Ты уже проголосовал — ID ${v.userId}`;status.className='voteStatus done';}else{status.textContent='Можно выбрать только одного стримера';status.className='voteStatus';}const allowed=new Set((v.streamerIndices||[]).map(Number));const list=streamers.map((s,i)=>({s,i})).filter(x=>allowed.size?allowed.has(x.i):true);$('voteCards').innerHTML=list.map(({s,i})=>{const count=v.votes?.[i]||0;const disabled=!v.enabled||v.voted;return `<article class="voteCard ${disabled?'isDisabled':''}"><div class="voteAvatar"><img src="${esc(s.image)}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'"></div><div class="voteInfo"><h3>${esc(s.name)}</h3><span>${count} голос${count===1?'':'ов'}</span></div><button ${disabled?'disabled':''} onclick="castVote(${i})">${v.voted?'Голос учтён':'Голосовать'}</button></article>`}).join('')||'<div class="empty">Сейчас нет доступных вариантов.</div>'}
async function castVote(i){if(!me?.authorized){openAuth();return}try{playUiSound('click');votingState=await api('/api/voting/vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({streamerIndex:i})});renderVoting();showToast('Голос принят');playUiSound('success')}catch(e){showToast(e.message,true)}}
function showToast(t,bad=false){const el=$('toast');if(!el)return;el.textContent=t;el.className='siteToast show'+(bad?' bad':'');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.className='siteToast',2200)}
function playUiSound(kind='click'){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=window.__blitzAudio||(window.__blitzAudio=new AC());if(ctx.state==='suspended')ctx.resume();const now=ctx.currentTime;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='success'?'sine':'triangle';const base=kind==='success'?520:kind==='wrong'?170:kind==='nav'?330:260;osc.frequency.setValueAtTime(base,now);osc.frequency.exponentialRampToValueAtTime(kind==='success'?880:base*1.45,now+.12);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.16);osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.17);if(kind==='success'){setTimeout(()=>playUiSound('click'),85)}}catch{}}
function openAuth(){$('authModal').classList.remove('hidden')}
function closeAuth(){$('authModal').classList.add('hidden');$('idError').textContent=''}
async function login(){try{const meNow=await api("/api/me");if(meNow.authorized){setLogged(meNow);closeAuth();return}const data=await api("/api/register",{method:"POST"});setLogged(data);closeAuth()}catch(e){alert(e.message)}}
async function logout(){await api('/api/logout',{method:'POST'});location.reload()}
async function startQuiz(i){const data=await api('/api/me');if(!data.authorized){openAuth();return}me=data;current=streamers[i];currentIndex=current.index;qi=0;score=0;combo=0;primeResultAudio(current);resetResultMedia();$('home').classList.add('hidden');$('result').classList.add('hidden');$('quiz').classList.add('hidden');playUiSound('nav');playIntro(current,()=>{$('quiz').classList.remove('hidden');$('quizImg').src=current.image;$('quizName').textContent=current.name;$('qTotal').textContent=current.questions.length;showQuestion()})}
function showQuestion(){locked=false;const q=current.questions[qi];$('quiz').classList.remove('questionIn');void $('quiz').offsetWidth;$('quiz').classList.add('questionIn');$('qNum').textContent=String(qi+1).padStart(2,'0');$('question').textContent=q.q;$('answers').innerHTML=q.answers.map((a,i)=>`<button class="answer" onclick="answer(${i})"><span>${String.fromCharCode(65+i)}</span>${esc(a)}</button>`).join('');$('progress').style.width=((qi)/current.questions.length*100)+'%';$('streak').textContent=`COMBO ×${combo}`}
function answer(i){if(locked)return;locked=true;const q=current.questions[qi],buttons=[...document.querySelectorAll('.answer')];buttons.forEach(b=>b.disabled=true);if(i===q.correct){score++;combo++;buttons[i].classList.add('correct');popText('CORRECT +1');playUiSound('success')}else{combo=0;buttons[i].classList.add('wrong');buttons[q.correct]?.classList.add('correct');popText('Мимо');playUiSound('wrong')}setTimeout(()=>{qi++;if(qi>=current.questions.length)finish();else showQuestion()},480)}
async function finish(){
  $('quiz').classList.add('hidden');
  try{
    const data=await api('/api/attempt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({correct:score,total:current.questions.length,streamerIndex:currentIndex})});
    if(data.global){globalStats=data.global;renderGlobalStats(globalStats)}
    // Второй запрос гарантирует, что панель показывает свежую общую статистику даже при кэше браузера/прокси.
    globalStats=await api('/api/stats?fresh='+Date.now());
    renderGlobalStats(globalStats);
  }catch(e){
    try{globalStats=await api('/api/stats?fresh='+Date.now());renderGlobalStats(globalStats)}catch{}
  }
  playOutro(current,()=>{
    $('result').classList.remove('hidden');
    $('score').textContent=`${score}/${current.questions.length}`;
    $('resultPhrase').textContent=getResultPhrase(score,current.questions.length,current.name);
    $('resultText').textContent=`Ты прошёл ${current.name}. Результат уже попал в общую статистику.`;
    startResultMedia(current);
    fireConfetti(score===current.questions.length);
  });
}

function resetResultMedia(){
  clearInterval(resultPhotoTimer);clearTimeout(audioStopTimer);resultPhotoTimer=null;audioStopTimer=null;resultPhotoIndex=0;
  const box=$('resultMedia');if(box)box.classList.add('hidden');
  const photos=$('resultFallPhotos');if(photos){photos.innerHTML='';photos.style.display='none';}
  const audio=$('resultAudio');if(audio){audio.pause();audio.currentTime=0;audio.removeAttribute('src');audio.load()}
}
function primeResultAudio(s){
  const audio=$('resultAudio');if(!audio)return;const a=s?.resultMedia?.audio;if(!a?.url)return;
  audio.src=a.url;audio.preload='auto';audio.muted=true;audio.load();audioPrimed=false;
  const p=audio.play();if(p&&p.then){p.then(()=>{audioPrimed=true;audio.pause();audio.currentTime=0}).catch(()=>{audioPrimed=false})}
}
function startFallingPhotos(photos){
  let box=$('resultFallPhotos');if(!photos.length)return;
  if(box.parentElement!==document.body)document.body.appendChild(box);
  box.innerHTML='';box.style.display='block';
  let index=0;
  const drop=()=>{
    if(!document.body.contains(box)||!photos.length)return;
    const img=document.createElement('img');
    img.src=photos[index%photos.length];index++;
    img.className='fallPhoto';
    img.style.left=(5+Math.random()*90)+'%';
    img.style.setProperty('--rot',(Math.random()*36-18)+'deg');
    img.onerror=()=>img.remove();
    box.appendChild(img);
    setTimeout(()=>img.remove(),6000);
  };
  for(let i=0;i<4;i++)setTimeout(drop,i*180);
  resultPhotoTimer=setInterval(drop,600);
}

function startResultMedia(s){
  const media=s?.resultMedia||{},photos=Array.isArray(media.photos)?media.photos.filter(Boolean):[],a=media.audio||{};
  const box=$('resultMedia');if(!box)return;
  if(!photos.length&&!a.url){box.classList.add('hidden');return}
  box.classList.remove('hidden');box.style.display='block';
  if(photos.length)startFallingPhotos(photos);
  if(a.url){
    const audio=$('resultAudio');audio.src=a.url;audio.muted=false;audio.volume=.95;audio.currentTime=Math.max(0,Number(a.start)||0);
    const end=Math.max(0,Number(a.end)||0);
    const stop=()=>{if(end>0&&audio.currentTime>=end){audio.pause();audio.currentTime=end;clearTimeout(audioStopTimer);audioStopTimer=null}};
    audio.ontimeupdate=stop;
    const play=audio.play();if(play&&play.catch)play.catch(()=>{});
    if(end>0)audioStopTimer=setTimeout(()=>{audio.pause();audio.currentTime=end},Math.max(0,(end-(Number(a.start)||0))*1000+250));
  }
}

function getResultPhrase(n,total,name){
  if(n===total)return `ТЫ КРАСАВА ТЫ ЗНАЕШЬ ${name.toUpperCase()} КАК РОДНОГО БРАТА`;
  return ({
    1:'ЧЕЛ ТЫ ВООБЩЕ НЕ ШАРИШЬ',
    2:'БРО ТЕБЕ НАДО ТРЕНИРОВАТЬСЯ',
    3:'ПАЦАН ТЫ СТАНОВИШЬСЯ ЛУЧШЕ',
    4:'НУУ.. ПОЙДЕТ',
    5:'УЧИСЬ СТУДЕНТ',
    6:'ДАЛЬШЕ — БОЛЬШЕ',
    7:'Я УВЕРЕН ЧТО ТЫ СТАЛ БОЛЬШЕ ИХ СМОТРЕТЬ',
    8:'НЕМНОГО ДОСМОТРИ И БУДЕТ 10/10',
    9:'НУ ТЫ ИДЕШЬ НА ФИНИШНУЮ ПРЯМУЮ БРАТАН',
    0:'ПОКА ТЫ ЕЩЁ РАЗМИНАЕШЬСЯ — ПОПРОБУЙ ЕЩЁ РАЗ'
  })[n]||'НЕПЛОХО. ЕЩЁ ОДИН ЗАБЕГ?';
}
function replayCurrent(){startQuiz(streamers.findIndex(s=>s.index===currentIndex))}
function playIntro(s,done){
  const o=$('fxOverlay');
  o.className=`fxOverlay show intro effect-${effectClass(s.name)}`;
  o.innerHTML=`<div class="blitzLines"></div><div class="blitzBolt boltA"></div><div class="blitzBolt boltB"></div><div class="blitzFlash"></div><div class="fxGrid"></div><div class="blitzScan"></div><div class="fxSmall">БЛИЦ / READY CHECK</div><div class="fxReady">СЕЙЧАС ПРОВЕРИМ, НАСКОЛЬКО ТЫ ШАРИШЬ</div><div class="fxAvatar"><img src="${s.image}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}'"></div><div class="fxName">${esc(s.name)}</div><div class="blitzCountdown" id="blitzCountdown">3</div><div class="fxLabel">ПРИГОТОВЬСЯ</div>`;
  const c=$('blitzCountdown');
  let n=3;c.textContent=n;
  const timer=setInterval(()=>{n--;if(n>0)c.textContent=n;else if(n===0)c.textContent='GO';else{clearInterval(timer);o.classList.remove('show');setTimeout(done,300)}},430);
}
function playOutro(s,done){
  const o=$('fxOverlay');
  o.className=`fxOverlay show outro effect-${effectClass(s.name)}`;
  const phrase=getResultPhrase(score,current.questions.length,s.name);
  o.innerHTML=`<div class="blitzLines"></div><div class="blitzBolt boltA"></div><div class="blitzBolt boltB"></div><div class="blitzFlash"></div><div class="fxGrid"></div><div class="blitzScan"></div><div class="fxSmall">БЛИЦ / РЕЗУЛЬТАТ</div><div class="fxScore">${score}/${current.questions.length}</div><div class="fxName">${esc(s.name)}</div><div class="fxResultLine">${esc(phrase)}</div>`;
  setTimeout(()=>{o.classList.remove('show');setTimeout(done,300)},1250);
}
function effectClass(name){return ({megarush51:'mega',mmr9i9:'glitch',m4ga:'rings',realykekss:'diamonds',emilshe1nru:'night',j05k1y:'speed',del1ght:'shock'})[String(name).toLowerCase()]||'default'}
function goHome(){resetResultMedia();showHome()}
function nextFunFact(){factIndex=(factIndex+1)%funFacts.length;$('funFact').textContent=funFacts[factIndex]}
function popText(t){const p=document.createElement('div');p.className='popText';p.textContent=t;document.body.appendChild(p);setTimeout(()=>p.remove(),650)}
function fireConfetti(perfect){const n=perfect?80:24;for(let i=0;i<n;i++){const x=document.createElement('i');x.className='confetti';x.style.left=Math.random()*100+'vw';x.style.animationDelay=Math.random()*.25+'s';x.style.setProperty('--r',(Math.random()*720-360)+'deg');document.body.appendChild(x);setTimeout(()=>x.remove(),1800)}}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
init();
