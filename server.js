const express=require('express');
const cookieParser=require('cookie-parser');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const app=express();
const PORT=process.env.PORT||3000;
const DATA_FILE=path.join(__dirname,'data.json');
const ADMIN_LOGIN=(process.env.ADMIN_LOGIN||'HOLLYMMOLLY29').trim();
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'CHANGE_ME_ADMIN_PASSWORD';
const SESSION_SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');

app.use(express.json({limit:'1mb'}));
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(__dirname));

function readData(){
  try{
    const d=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
    d.users=d.users||{};
    d.sessions=d.sessions||{};
    d.streamers=Array.isArray(d.streamers)?d.streamers:[];
    d.streamers=d.streamers.map(s=>({...s,active:s.active!==false}));
    return d;
  }catch{return {users:{},sessions:{},streamers:[]}}
}
function writeData(data){fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2),'utf8')}
function normalizeUser(user){
  user.attempts=user.attempts||0; user.correct=user.correct||0; user.streamers=user.streamers||{};
  return user;
}
function hasUser(data,id){return Object.prototype.hasOwnProperty.call(data.users,String(id))}
function randomUserId(data){
  const used=new Set(Object.keys(data.users).map(Number));
  for(let n=0;n<300;n++){
    const id=Math.floor(Math.random()*100001);
    if(id!==67&&!used.has(id)) return id;
  }
  for(let id=0;id<=100000;id++) if(id!==67&&!used.has(id)) return id;
  throw new Error('Нет свободных ID');
}
function sessionId(){return crypto.randomBytes(32).toString('hex')}
function setSession(res,sid){res.cookie('blitz_session',sid,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:365*24*60*60*1000})}
function getSessionUser(req,data){
  const sid=req.signedCookies?.blitz_session;
  if(!sid||!data.sessions[sid]) return null;
  const id=Number(data.sessions[sid].id);
  return hasUser(data,id)?data.users[String(id)]:null;
}
function getSessionId(req){return req.signedCookies?.blitz_session||null}
function isAdminUser(user){return !!user && Number(user.id)===67 && user.role==='admin'}
function publicUser(user){return {id:user.id,name:user.name,attempts:user.attempts||0,correct:user.correct||0}}
function makeMeStats(data,user){
  normalizeUser(user);
  const streamerStats=data.streamers.map((s,index)=>{
    const st=user.streamers[String(index)]||{attempts:0,correct:0};
    return {index,name:s.name,attempts:st.attempts||0,correct:st.correct||0,hidden:s.active===false};
  }).filter(s=>!s.hidden||s.attempts>0);
  return {...publicUser(user),streamers:streamerStats};
}
function aggregateStats(data){
  const allUsers=Object.values(data.users);
  const publicUsers=allUsers.filter(u=>!isAdminUser(u));
  let attempts=0,correct=0; const streamerMap={}; const players=[];
  allUsers.forEach(raw=>{
    const u=normalizeUser(raw); const admin=isAdminUser(u);
    if(!admin){attempts+=Number(u.attempts)||0;correct+=Number(u.correct)||0;players.push({id:u.id,name:u.name,attempts:Number(u.attempts)||0,correct:Number(u.correct)||0})}
    Object.entries(u.streamers||{}).forEach(([index,st])=>{if(!streamerMap[index])streamerMap[index]={attempts:0,correct:0};streamerMap[index].attempts+=Number(st.attempts)||0;streamerMap[index].correct+=Number(st.correct)||0})
  });
  players.sort((a,b)=>b.correct-a.correct||b.attempts-a.attempts||a.id-b.id);
  const streamers=data.streamers.map((s,index)=>({index,name:s.name,image:s.image,active:s.active!==false,attempts:streamerMap[String(index)]?.attempts||0,correct:streamerMap[String(index)]?.correct||0})).filter(s=>s.active||s.attempts>0);
  streamers.sort((a,b)=>b.attempts-a.attempts||b.correct-a.correct);
  return {players:publicUsers.length,attempts,correct,streamers,topPlayers:players.slice(0,8)};
}

app.post('/api/register',(req,res)=>{
  const name=String(req.body?.name||'').trim(); const password=String(req.body?.password||'');
  if(name.length<3||name.length>24) return res.status(400).json({error:'Ник должен быть от 3 до 24 символов'});
  if(!/^[\p{L}\p{N}_.-]+$/u.test(name)) return res.status(400).json({error:'Используй только буквы, цифры, _, . или -'});
  if(password.length<6||password.length>128) return res.status(400).json({error:'Пароль должен быть от 6 до 128 символов'});
  const data=readData(); const exists=Object.values(data.users).some(u=>String(u.name||'').toLowerCase()===name.toLowerCase());
  if(exists) return res.status(409).json({error:'Такой пользователь уже существует'});
  const isAdmin=name.toLowerCase()===ADMIN_LOGIN.toLowerCase() && password===ADMIN_PASSWORD;
  if(name.toLowerCase()===ADMIN_LOGIN.toLowerCase() && !isAdmin) return res.status(403).json({error:'Этот ник зарезервирован'});
  const id=isAdmin?67:randomUserId(data); const salt=crypto.randomBytes(16).toString('hex');
  const hash=crypto.scryptSync(password,salt,64).toString('hex');
  const user={id,name,role:isAdmin?'admin':'user',passwordHash:hash,passwordSalt:salt,attempts:0,correct:0,streamers:{},createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()};
  data.users[String(id)]=user; const sid=sessionId(); data.sessions[sid]={id,createdAt:new Date().toISOString()};
  writeData(data); setSession(res,sid); res.json({ok:true,id,name,admin:isAdmin,stats:makeMeStats(data,user)});
});
app.post('/api/login',(req,res)=>{
  const name=String(req.body?.name||'').trim(); const password=String(req.body?.password||''); const data=readData();
  const user=Object.values(data.users).find(u=>String(u.name||'').toLowerCase()===name.toLowerCase());
  if(!user||!user.passwordHash||!user.passwordSalt) return res.status(401).json({error:'Неверный ник или пароль'});
  const hash=crypto.scryptSync(password,user.passwordSalt,64).toString('hex');
  if(hash!==user.passwordHash) return res.status(401).json({error:'Неверный ник или пароль'});
  user.lastSeen=new Date().toISOString(); const sid=sessionId(); data.sessions[sid]={id:user.id,createdAt:new Date().toISOString()};
  writeData(data); setSession(res,sid); res.json({ok:true,id:user.id,name:user.name,admin:isAdminUser(user),stats:makeMeStats(data,user)});
});

app.get('/api/me',(req,res)=>{const data=readData(),user=getSessionUser(req,data);if(!user)return res.json({authorized:false});res.json({authorized:true,id:user.id,name:user.name,admin:isAdminUser(user),stats:makeMeStats(data,user)})});
app.get('/api/streamers',(req,res)=>{const d=readData();res.json(d.streamers.map((s,index)=>({...s,index})).filter(s=>s.active!==false))});
app.get('/api/stats',(req,res)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');res.json(aggregateStats(readData()))});
app.post('/api/logout',(req,res)=>{const d=readData(),sid=getSessionId(req);if(sid)delete d.sessions[sid];writeData(d);res.clearCookie('blitz_session');res.json({ok:true})});

app.post('/api/attempt',(req,res)=>{
  const data=readData(),user=getSessionUser(req,data); if(!user)return res.status(401).json({error:'Авторизуйтесь'}); if(isAdminUser(user))return res.json({ok:true,stats:makeMeStats(data,user),global:aggregateStats(data)});
  const index=Number(req.body?.streamerIndex); if(!Number.isInteger(index)||!data.streamers[index])return res.status(400).json({error:'Стример не найден'});
  const total=Array.isArray(data.streamers[index].questions)?data.streamers[index].questions.length:0;const correct=Math.max(0,Math.min(total,Number(req.body?.correct)||0));normalizeUser(user);user.attempts+=1;user.correct+=correct;user.streamers[String(index)]=user.streamers[String(index)]||{attempts:0,correct:0};user.streamers[String(index)].attempts+=1;user.streamers[String(index)].correct+=correct;user.lastSeen=new Date().toISOString();writeData(data);res.json({ok:true,stats:makeMeStats(data,user),global:aggregateStats(data)});
});

function currentAdmin(req){const d=readData();const u=getSessionUser(req,d);return u&&isAdminUser(u)?u:null}
app.get('/api/admin',(req,res)=>{if(!currentAdmin(req))return res.status(403).json({error:'Нет доступа'});const d=readData();res.json({streamers:d.streamers.map((s,index)=>({...s,index})),users:Object.values(d.users).filter(u=>!isAdminUser(u)).map(normalizeUser).map(publicUser),global:aggregateStats(d)})});
app.put('/api/admin/streamers/:index',(req,res)=>{if(!currentAdmin(req))return res.status(403).json({error:'Нет доступа'});const d=readData(),i=Number(req.params.index);if(!d.streamers[i])return res.status(404).json({error:'Не найдено'});const old=d.streamers[i],b=req.body||{};d.streamers[i]={name:String(b.name??old.name),image:String(b.image??old.image),active:b.active!==false,questions:Array.isArray(b.questions)?b.questions.map(q=>({q:String(q.q||''),answers:Array.isArray(q.answers)?q.answers.slice(0,4).map(x=>String(x??'')):['','','',''],correct:Math.max(0,Math.min(3,Number(q.correct)||0))})):old.questions};writeData(d);res.json({ok:true})});

app.listen(PORT,()=>console.log('БЛИЦ: http://localhost:'+PORT));
