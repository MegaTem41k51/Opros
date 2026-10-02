const express=require('express');
const cookieParser=require('cookie-parser');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const multer=require('multer');

const app=express();
const PORT=process.env.PORT||3000;
// Render Free не даёт записывать в /var/data. Используем его только если путь
// реально доступен; иначе автоматически переключаемся на локальную папку.
function getWritableDataDir(){
  const candidates = [];
  if(process.env.DATA_DIR) candidates.push(process.env.DATA_DIR);
  if(process.env.RENDER) candidates.push('/var/data');
  candidates.push(path.join(__dirname,'persistent-data'));
  for(const dir of candidates){
    try{
      fs.mkdirSync(dir,{recursive:true});
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    }catch(e){}
  }
  throw new Error('Не удалось найти папку для записи данных');
}
const PERSIST_DIR=getWritableDataDir();
const DATA_FILE=path.join(PERSIST_DIR,'data.json');
const SEED_DATA_FILE=path.join(__dirname,'data.json');
const SESSION_SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
const ADMIN_PANEL_KEY=process.env.ADMIN_PANEL_KEY||'OPROS-SECRET-ADMIN-9f4c7b2a';
const ADMIN_ROUTE='/admin-panel-OPROS.html';

app.use(express.json({limit:'2mb'}));
app.use(cookieParser(SESSION_SECRET));
const UPLOAD_DIR=path.join(PERSIST_DIR,'uploads');
if(!fs.existsSync(UPLOAD_DIR))fs.mkdirSync(UPLOAD_DIR,{recursive:true});

function maintenancePage(){return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>БЛИЦ — Технические работы</title><link rel="icon" href="https://i.ibb.co/HQb170K/123.png"><style>html,body{margin:0;min-height:100%;background:#07050b;color:#fff;font-family:Inter,system-ui,sans-serif}body{display:grid;place-items:center;overflow:hidden}body:before{content:"";position:fixed;inset:-30%;background:radial-gradient(circle at 50% 40%,#a85cff35,transparent 28%),radial-gradient(circle at 20% 80%,#fff12,transparent 25%);filter:blur(20px)}.box{position:relative;text-align:center;padding:50px 30px;width:min(620px,80vw);border:1px solid #ffffff18;border-radius:30px;background:#0e0a16e8;box-shadow:0 40px 120px #000b,0 0 80px #a45cff20}.box img{width:82px;height:82px;object-fit:cover;border-radius:22px;box-shadow:0 0 45px #a45cff55}.ey{margin-top:25px;color:#b88aff;font-size:10px;letter-spacing:4px;font-weight:900}.box h1{font-size:clamp(34px,7vw,64px);margin:10px 0}.box p{color:#94879f;font-size:14px;line-height:1.6}</style></head><body><div class="box"><img src="https://i.ibb.co/HQb170K/123.png"><div class="ey">BLITZ / MAINTENANCE</div><h1>Технические работы</h1><p>На данный момент сайт находится на технических работах.<br>Скоро вернёмся.</p></div></body></html>`}

app.get('/',(req,res)=>{const d=readData();const u=getSessionUser(req,d);if(!d.site.enabled&&!u)return res.status(503).send(maintenancePage());res.sendFile(path.join(__dirname,'index.html'))});
app.get('/index.html',(req,res)=>{const d=readData();const u=getSessionUser(req,d);if(!d.site.enabled&&!u)return res.status(503).send(maintenancePage());res.sendFile(path.join(__dirname,'index.html'))});
// Закрытая панель владельца должна получить cookie до static middleware.
app.get(ADMIN_ROUTE,(req,res)=>{res.cookie('blitz_master_admin','1',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:365*24*60*60*1000});res.sendFile(path.join(__dirname,'admin-panel-OPROS.html'))});
app.get('/admin.html',(req,res)=>res.redirect(ADMIN_ROUTE));
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOAD_DIR, {maxAge:'1h'}));

// При первом запуске переносим стартовые вопросы/настройки из репозитория
// в постоянное хранилище. После этого persistent data больше не перезаписывается.
if(!fs.existsSync(DATA_FILE) && fs.existsSync(SEED_DATA_FILE)) {
  fs.copyFileSync(SEED_DATA_FILE, DATA_FILE);
}

const mediaStorage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,UPLOAD_DIR),
  filename:(req,file,cb)=>{
    const ext=path.extname(file.originalname).toLowerCase().slice(0,10);
    cb(null,crypto.randomBytes(14).toString('hex')+ext);
  }
});
const mediaUpload=multer({
  storage:mediaStorage,
  limits:{fileSize:25*1024*1024,files:20},
  fileFilter:(req,file,cb)=>{
    const okImage=/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
    const okAudio=/^audio\/(mpeg|ogg|wav|mp4|x-m4a|aac|webm)$/i.test(file.mimetype)||/\.(mp3|ogg|wav|m4a|aac|webm)$/i.test(file.originalname);
    if(req.path.includes('/audio')?okAudio:okImage)cb(null,true);else cb(new Error('Неподдерживаемый формат файла'));
  }
});

function readData(){
  try{
    const d=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
    d.users=d.users||{};d.sessions=d.sessions||{};d.votes=d.votes||{};
    d.site=d.site&&typeof d.site==='object'?d.site:{};d.site.enabled=d.site.enabled!==false;
    d.voting=d.voting&&typeof d.voting==='object'?d.voting:{};d.voting.enabled=d.voting.enabled!==false;d.voting.title=String(d.voting.title||'Голосование');
    d.streamers=Array.isArray(d.streamers)?d.streamers:[];
    d.voting.streamerIndices=Array.isArray(d.voting.streamerIndices)?d.voting.streamerIndices.map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<d.streamers.length):d.streamers.map((_,i)=>i);
    d.streamers=d.streamers.map(s=>{const m=s.resultMedia&&typeof s.resultMedia==='object'?s.resultMedia:{};const a=m.audio&&typeof m.audio==='object'?m.audio:{};return {...s,active:s.active!==false,resultMedia:{audio:{url:String(a.url||''),start:Math.max(0,Number(a.start)||0),end:Math.max(0,Number(a.end)||0),enabled:a.enabled===true},photos:Array.isArray(m.photos)?m.photos.map(v=>String(v||'').trim()).filter(Boolean).slice(0,20):[]}}});
    return d
  }catch{return {users:{},sessions:{},votes:{},site:{enabled:true},voting:{enabled:true,title:'Голосование',streamerIndices:[]},streamers:[]}}
}
function writeData(data){fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2),'utf8')}
function normalizeUser(u){u.attempts=Number(u.attempts)||0;u.correct=Number(u.correct)||0;u.streamers=u.streamers||{};u.admin=!!u.admin;return u}
function hasUser(d,id){return Object.prototype.hasOwnProperty.call(d.users,String(id))}
function randomUserId(d){const used=new Set(Object.keys(d.users).map(Number));for(let n=0;n<500;n++){const id=Math.floor(Math.random()*100001);if(!used.has(id))return id}for(let id=0;id<=100000;id++)if(!used.has(id))return id;throw new Error('Нет свободных ID')}
function sessionId(){return crypto.randomBytes(32).toString('hex')}
function setSession(res,sid){res.cookie('blitz_session',sid,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:365*24*60*60*1000})}
function getSessionUser(req,d){const sid=req.cookies?.blitz_session;if(!sid||!d.sessions[sid])return null;const id=Number(d.sessions[sid].id);return hasUser(d,id) && !d.users[String(id)].banned ? normalizeUser(d.users[String(id)]) : null}
function getSessionId(req){return req.cookies?.blitz_session||null}
function publicUser(u){return {id:u.id,name:u.name||'Игрок',attempts:u.attempts||0,correct:u.correct||0,admin:!!u.admin}}
function makeStats(d,u){normalizeUser(u);return {...publicUser(u),streamers:d.streamers.map((s,i)=>{const st=u.streamers[String(i)]||{attempts:0,correct:0};return {index:i,name:s.name,attempts:st.attempts||0,correct:st.correct||0,hidden:s.active===false}}).filter(s=>!s.hidden||s.attempts>0)}}
function aggregateStats(d){const users=Object.values(d.users).map(normalizeUser);let attempts=0,correct=0;const map={};const players=[];for(const u of users){if(!u.admin){attempts+=u.attempts;correct+=u.correct;players.push({id:u.id,name:u.name||'Игрок',attempts:u.attempts,correct:u.correct,admin:false})}for(const [i,st] of Object.entries(u.streamers)){map[i]??={attempts:0,correct:0};map[i].attempts+=Number(st.attempts)||0;map[i].correct+=Number(st.correct)||0}}
players.sort((a,b)=>b.correct-a.correct||b.attempts-a.attempts||a.id-b.id);
const streamers=d.streamers.map((s,i)=>({index:i,name:s.name,image:s.image,active:s.active!==false,attempts:map[i]?.attempts||0,correct:map[i]?.correct||0})).filter(s=>s.active||s.attempts>0);
return {players:players.length,attempts,correct,streamers,topPlayers:players.slice(0,8)}}
function requireUser(req,res){const d=readData(),u=getSessionUser(req,d);if(!u)return {d,u:null};return {d,u}}
function requireAdmin(req,res){
  if(req.cookies?.blitz_master_admin==='1') return {d:readData(),u:{id:'MASTER',name:'Владелец',admin:true},master:true};
  const x=requireUser(req,res);if(!x.u||!x.u.admin){res.status(403).json({error:'Нет доступа'});return null}return x
}

app.get('/api/me',(req,res)=>{const {d,u}=requireUser(req,res);if(!u)return res.json({authorized:false});res.json({authorized:true,id:u.id,name:u.name||'Игрок',admin:!!u.admin,stats:makeStats(d,u)})});
app.get('/api/streamers',(req,res)=>{const d=readData();res.json(d.streamers.map((s,index)=>({...s,index})).filter(s=>s.active!==false))});
app.get('/api/stats',(req,res)=>{res.set('Cache-Control','no-store');res.json(aggregateStats(readData()))});

// Простая авторизация: кнопка сразу создаёт аккаунт и выдаёт случайный ID.
app.post('/api/register',(req,res)=>{const d=readData();const id=randomUserId(d);const u={id,name:'Игрок '+id,attempts:0,correct:0,streamers:{},admin:false,createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()};d.users[String(id)]=u;const sid=sessionId();d.sessions[sid]={id,createdAt:new Date().toISOString()};writeData(d);setSession(res,sid);res.json({authorized:true,id,name:u.name,admin:false,stats:makeStats(d,u)})});
app.post('/api/logout',(req,res)=>{const d=readData(),sid=getSessionId(req);if(sid)delete d.sessions[sid];writeData(d);res.clearCookie('blitz_session');res.json({ok:true})});
function votingSummary(d,req){const {u}=requireUser(req);const counts={};for(const idx of d.voting.streamerIndices||[]){counts[idx]=0}for(const vote of Object.values(d.votes||{})){const i=Number(vote);if(Number.isInteger(i))counts[i]=(counts[i]||0)+1}const meVote=u?d.votes[String(u.id)]:undefined;return {enabled:d.voting.enabled!==false,title:d.voting.title||'Голосование',streamerIndices:d.voting.streamerIndices||[],votes:counts,voted:meVote!==undefined,userId:u?.id??null,votedIndex:meVote===undefined?null:Number(meVote)}}
app.get('/api/voting',(req,res)=>{res.set('Cache-Control','no-store');const d=readData();res.json(votingSummary(d,req))});
app.post('/api/voting/vote',(req,res)=>{const {d,u}=requireUser(req,res);if(!u)return res.status(401).json({error:'Сначала авторизуйся'});if(d.voting.enabled===false)return res.status(403).json({error:'Голосования (В разработке)'});const i=Number(req.body?.streamerIndex);if(!Number.isInteger(i)||!(d.voting.streamerIndices||[]).includes(i))return res.status(400).json({error:'Этот стример сейчас недоступен для голосования'});if(Object.prototype.hasOwnProperty.call(d.votes,String(u.id)))return res.status(409).json({error:'Ты уже голосовал с этого ID'});d.votes[String(u.id)]=i;u.lastSeen=new Date().toISOString();writeData(d);res.json(votingSummary(d,req))});

app.post('/api/attempt',(req,res)=>{const {d,u}=requireUser(req,res);if(!u)return res.status(401).json({error:'Авторизуйтесь'});if(u.admin)return res.json({ok:true,stats:makeStats(d,u),global:aggregateStats(d)});const i=Number(req.body?.streamerIndex);if(!Number.isInteger(i)||!d.streamers[i])return res.status(400).json({error:'Стример не найден'});const total=Array.isArray(d.streamers[i].questions)?d.streamers[i].questions.length:0;const correct=Math.max(0,Math.min(total,Number(req.body?.correct)||0));normalizeUser(u);u.attempts++;u.correct+=correct;u.streamers[String(i)]??={attempts:0,correct:0};u.streamers[String(i)].attempts++;u.streamers[String(i)].correct+=correct;u.lastSeen=new Date().toISOString();writeData(d);res.json({ok:true,stats:makeStats(d,u),global:aggregateStats(d)})});

function uploadAdminGuard(req,res,next){const x=requireAdmin(req,res);if(!x)return;next()}
app.post('/api/admin/upload/audio',uploadAdminGuard,mediaUpload.single('audio'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'Файл музыки не выбран'});
  res.json({ok:true,url:'/uploads/'+req.file.filename,name:req.file.originalname,size:req.file.size});
});
app.post('/api/admin/upload/photos',uploadAdminGuard,mediaUpload.array('photos',20),(req,res)=>{
  const files=req.files||[];
  if(!files.length)return res.status(400).json({error:'Фотографии не выбраны'});
  res.json({ok:true,files:files.map(f=>({url:'/uploads/'+f.filename,name:f.originalname,size:f.size}))});
});

app.get('/api/admin',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const {d}=x;res.json({settings:{siteEnabled:d.site.enabled!==false,votingEnabled:d.voting.enabled!==false,votingTitle:d.voting.title||'Голосование',votingStreamerIndices:d.voting.streamerIndices||[]},streamers:d.streamers.map((s,index)=>({...s,index})),users:Object.values(d.users).map(normalizeUser).filter(u=>!u.admin).map(publicUser),admins:Object.values(d.users).map(normalizeUser).filter(u=>u.admin).map(publicUser),global:aggregateStats(d),masterRoute:ADMIN_ROUTE})});
app.get('/api/admin/backup',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=readData();const stamp=new Date().toISOString().replace(/[:.]/g,'-');res.set('Content-Type','application/json; charset=utf-8');res.set('Content-Disposition',`attachment; filename="blitz-data-backup-${stamp}.json"`);res.set('Cache-Control','no-store');res.send(JSON.stringify(d,null,2))});
app.put('/api/admin/settings',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,b=req.body||{};if(typeof b.siteEnabled==='boolean')d.site.enabled=b.siteEnabled;if(typeof b.votingEnabled==='boolean')d.voting.enabled=b.votingEnabled;if(typeof b.votingTitle==='string'&&b.votingTitle.trim())d.voting.title=b.votingTitle.trim();if(Array.isArray(b.votingStreamerIndices))d.voting.streamerIndices=[...new Set(b.votingStreamerIndices.map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<d.streamers.length))];writeData(d);res.json({ok:true,settings:{siteEnabled:d.site.enabled!==false,votingEnabled:d.voting.enabled!==false,votingTitle:d.voting.title,votingStreamerIndices:d.voting.streamerIndices}})});
app.post('/api/admin/reset-votes',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d;d.votes={};writeData(d);res.json({ok:true})});

app.put('/api/admin/streamers/:index',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const {d}=x,i=Number(req.params.index);if(!d.streamers[i])return res.status(404).json({error:'Не найдено'});const old=d.streamers[i],b=req.body||{};const media=b.resultMedia&&typeof b.resultMedia==='object'?b.resultMedia:old.resultMedia||{};
const audio=media.audio&&typeof media.audio==='object'?media.audio:{};
const photos=Array.isArray(media.photos)?media.photos.map(v=>String(v||'').trim()).filter(Boolean).slice(0,20):[];
d.streamers[i]={name:String(b.name??old.name),image:String(b.image??old.image),active:b.active!==false,resultMedia:{audio:{url:String(audio.url||'').trim(),start:Math.max(0,Number(audio.start)||0),end:Math.max(0,Number(audio.end)||0),enabled:audio.enabled!==false&&!!String(audio.url||'').trim()},photos},questions:Array.isArray(b.questions)?b.questions.map(q=>({q:String(q.q||''),answers:Array.isArray(q.answers)?q.answers.slice(0,4).map(v=>String(v??'')):['','','',''],correct:Math.max(0,Math.min(3,Number(q.correct)||0))})):old.questions};writeData(d);res.json({ok:true})});
app.post('/api/admin/grant',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.body?.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);u.admin=true;writeData(d);res.json({ok:true,user:publicUser(u)})});
app.post('/api/admin/revoke',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.body?.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);u.admin=false;writeData(d);res.json({ok:true,user:publicUser(u)})});
app.get('/api/admin/user/:id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.params.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);res.json({...publicUser(u),createdAt:u.createdAt,lastSeen:u.lastSeen,streamers:u.streamers})});
app.post('/api/admin/reset/:id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.params.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);u.attempts=0;u.correct=0;u.streamers={};u.lastSeen=new Date().toISOString();writeData(d);res.json({ok:true,user:publicUser(u)})});
app.post('/api/admin/ban/:id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.params.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);u.banned=true;Object.entries(d.sessions).forEach(([sid,s])=>{if(String(s.id)===id)delete d.sessions[sid]});writeData(d);res.json({ok:true})});
app.post('/api/admin/unban/:id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.params.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});d.users[id].banned=false;writeData(d);res.json({ok:true})});
app.post('/api/admin/change-id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,oldId=String(Number(req.body?.oldId)),newId=Number(req.body?.newId);if(!hasUser(d,oldId))return res.status(404).json({error:'Старого ID нет'});if(!Number.isInteger(newId)||newId<0||newId>100000)return res.status(400).json({error:'Новый ID должен быть 0–100000'});if(hasUser(d,String(newId)))return res.status(409).json({error:'Новый ID уже занят'});const u=d.users[oldId];u.id=newId;u.name='Игрок '+newId;d.users[String(newId)]=u;delete d.users[oldId];if(Object.prototype.hasOwnProperty.call(d.votes,oldId)){d.votes[String(newId)]=d.votes[oldId];delete d.votes[oldId];}for(const sid of Object.keys(d.sessions)){if(String(d.sessions[sid].id)===oldId)d.sessions[sid].id=newId}writeData(d);res.json({ok:true,user:publicUser(u)})});


app.listen(PORT,()=>{console.log('БЛИЦ: http://localhost:'+PORT);console.log('SECRET ADMIN URL: '+BASE_ADMIN_URL())});
function BASE_ADMIN_URL(){const base=(process.env.BASE_URL||`http://localhost:${PORT}`).replace(/\/$/,'');return base+ADMIN_ROUTE}
