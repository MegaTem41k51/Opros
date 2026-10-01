const express=require('express');
const cookieParser=require('cookie-parser');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const app=express();
const PORT=process.env.PORT||3000;
const DATA_FILE=path.join(__dirname,'data.json');
const ADMIN_LOGIN=(process.env.ADMIN_TWITCH_LOGIN||'HOLLYMMOLLY29').trim().toLowerCase();
const TWITCH_CLIENT_ID=process.env.TWITCH_CLIENT_ID||'';
const TWITCH_CLIENT_SECRET=process.env.TWITCH_CLIENT_SECRET||'';
const BASE_URL=(process.env.BASE_URL||`http://localhost:${PORT}`).replace(/\/$/,'');
const TWITCH_REDIRECT_URI=process.env.TWITCH_REDIRECT_URI||`${BASE_URL}/auth/twitch/callback`;
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
function isAdminUser(user){return !!user && user.twitchId && user.twitchLogin && user.twitchLogin.toLowerCase()===ADMIN_LOGIN}
function publicUser(user){return {id:user.id,twitchLogin:user.twitchLogin,attempts:user.attempts||0,correct:user.correct||0}}
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
    if(!admin){attempts+=Number(u.attempts)||0;correct+=Number(u.correct)||0;players.push({id:u.id,name:u.twitchLogin,attempts:Number(u.attempts)||0,correct:Number(u.correct)||0})}
    Object.entries(u.streamers||{}).forEach(([index,st])=>{if(!streamerMap[index])streamerMap[index]={attempts:0,correct:0};streamerMap[index].attempts+=Number(st.attempts)||0;streamerMap[index].correct+=Number(st.correct)||0})
  });
  players.sort((a,b)=>b.correct-a.correct||b.attempts-a.attempts||a.id-b.id);
  const streamers=data.streamers.map((s,index)=>({index,name:s.name,image:s.image,active:s.active!==false,attempts:streamerMap[String(index)]?.attempts||0,correct:streamerMap[String(index)]?.correct||0})).filter(s=>s.active||s.attempts>0);
  streamers.sort((a,b)=>b.attempts-a.attempts||b.correct-a.correct);
  return {players:publicUsers.length,attempts,correct,streamers,topPlayers:players.slice(0,8)};
}

app.get('/auth/twitch',(req,res)=>{
  if(!TWITCH_CLIENT_ID) return res.status(500).send('Twitch OAuth не настроен: добавь TWITCH_CLIENT_ID.');
  const state=crypto.randomBytes(24).toString('hex');
  res.cookie('twitch_oauth_state',state,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:10*60*1000});
  const url=new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('response_type','code'); url.searchParams.set('client_id',TWITCH_CLIENT_ID);
  url.searchParams.set('redirect_uri',TWITCH_REDIRECT_URI); url.searchParams.set('scope','openid'); url.searchParams.set('state',state);
  res.redirect(url.toString());
});

app.get('/auth/twitch/callback',async(req,res)=>{
  try{
    const state=String(req.query.state||''); const saved=req.cookies.twitch_oauth_state||'';
    res.clearCookie('twitch_oauth_state');
    if(!state||!saved||state!==saved) return res.status(400).send('Не удалось проверить авторизацию Twitch. Попробуй ещё раз.');
    if(!TWITCH_CLIENT_ID||!TWITCH_CLIENT_SECRET) return res.status(500).send('Twitch OAuth не настроен на сервере.');
    if(req.query.error) return res.redirect('/?auth=cancel');
    const code=String(req.query.code||''); if(!code) return res.status(400).send('Не получен код Twitch.');
    const tokenResp=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:TWITCH_CLIENT_ID,client_secret:TWITCH_CLIENT_SECRET,code,grant_type:'authorization_code',redirect_uri:TWITCH_REDIRECT_URI})});
    const token=await tokenResp.json(); if(!tokenResp.ok||!token.access_token) return res.status(400).send('Twitch не выдал токен авторизации.');
    const userResp=await fetch('https://api.twitch.tv/helix/users',{headers:{'Client-Id':TWITCH_CLIENT_ID,'Authorization':`Bearer ${token.access_token}`}});
    const body=await userResp.json(); if(!userResp.ok||!body.data?.[0]) return res.status(400).send('Не удалось получить данные Twitch.');
    const tw=body.data[0]; const data=readData();
    let id=null; let user=Object.values(data.users).find(u=>u.twitchId===tw.id);
    if(user){id=Number(user.id);user.twitchLogin=tw.login;user.displayName=tw.display_name||tw.login;user.avatar=tw.profile_image_url||user.avatar;user.lastSeen=new Date().toISOString()}
    else{
      const admin=tw.login.toLowerCase()===ADMIN_LOGIN;
      id=admin?67:randomUserId(data);
      user={id,twitchId:tw.id,twitchLogin:tw.login,displayName:tw.display_name||tw.login,avatar:tw.profile_image_url||'',attempts:0,correct:0,streamers:{},createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()};
      data.users[String(id)]=user;
    }
    if(isAdminUser(user)&&user.id!==67){
      const oldId=String(user.id); delete data.users[oldId]; user.id=67; data.users['67']=user; id=67;
      Object.values(data.sessions).forEach(s=>{if(String(s.id)===oldId)s.id=67});
    }
    const sid=sessionId(); data.sessions[sid]={id,createdAt:new Date().toISOString()};
    writeData(data); setSession(res,sid); res.redirect('/?auth=ok');
  }catch(e){console.error(e);res.status(500).send('Ошибка авторизации Twitch.')}
});

app.get('/api/me',(req,res)=>{const data=readData(),user=getSessionUser(req,data);if(!user)return res.json({authorized:false});res.json({authorized:true,id:user.id,name:user.twitchLogin,admin:isAdminUser(user),stats:makeMeStats(data,user)})});
app.get('/api/streamers',(req,res)=>{const d=readData();res.json(d.streamers.map((s,index)=>({...s,index})).filter(s=>s.active!==false))});
app.get('/api/stats',(req,res)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');res.json(aggregateStats(readData()))});
app.post('/api/logout',(req,res)=>{const d=readData(),sid=getSessionId(req);if(sid)delete d.sessions[sid];writeData(d);res.clearCookie('blitz_session');res.json({ok:true})});

app.post('/api/attempt',(req,res)=>{
  const data=readData(),user=getSessionUser(req,data); if(!user)return res.status(401).json({error:'Авторизуйтесь через Twitch'}); if(isAdminUser(user))return res.json({ok:true,stats:makeMeStats(data,user),global:aggregateStats(data)});
  const index=Number(req.body?.streamerIndex); if(!Number.isInteger(index)||!data.streamers[index])return res.status(400).json({error:'Стример не найден'});
  const total=Array.isArray(data.streamers[index].questions)?data.streamers[index].questions.length:0;const correct=Math.max(0,Math.min(total,Number(req.body?.correct)||0));normalizeUser(user);user.attempts+=1;user.correct+=correct;user.streamers[String(index)]=user.streamers[String(index)]||{attempts:0,correct:0};user.streamers[String(index)].attempts+=1;user.streamers[String(index)].correct+=correct;user.lastSeen=new Date().toISOString();writeData(data);res.json({ok:true,stats:makeMeStats(data,user),global:aggregateStats(data)});
});

function currentAdmin(req){const d=readData();const u=getSessionUser(req,d);return u&&isAdminUser(u)?u:null}
app.get('/api/admin',(req,res)=>{if(!currentAdmin(req))return res.status(403).json({error:'Нет доступа'});const d=readData();res.json({streamers:d.streamers.map((s,index)=>({...s,index})),users:Object.values(d.users).filter(u=>!isAdminUser(u)).map(normalizeUser).map(publicUser),global:aggregateStats(d)})});
app.put('/api/admin/streamers/:index',(req,res)=>{if(!currentAdmin(req))return res.status(403).json({error:'Нет доступа'});const d=readData(),i=Number(req.params.index);if(!d.streamers[i])return res.status(404).json({error:'Не найдено'});const old=d.streamers[i],b=req.body||{};d.streamers[i]={name:String(b.name??old.name),image:String(b.image??old.image),active:b.active!==false,questions:Array.isArray(b.questions)?b.questions.map(q=>({q:String(q.q||''),answers:Array.isArray(q.answers)?q.answers.slice(0,4).map(x=>String(x??'')):['','','',''],correct:Math.max(0,Math.min(3,Number(q.correct)||0))})):old.questions};writeData(d);res.json({ok:true})});

app.listen(PORT,()=>console.log('БЛИЦ: http://localhost:'+PORT));
