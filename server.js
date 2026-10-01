const express=require('express');
const cookieParser=require('cookie-parser');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const app=express();
const PORT=process.env.PORT||3000;
const DATA_FILE=path.join(__dirname,'data.json');
const SESSION_SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
const ADMIN_PANEL_KEY=process.env.ADMIN_PANEL_KEY||'OPROS-SECRET-ADMIN-9f4c7b2a';
const ADMIN_ROUTE='/admin-panel-OPROS.html';

app.use(express.json({limit:'1mb'}));
app.use(cookieParser(SESSION_SECRET));
app.use(express.static(__dirname));

function readData(){
  try{const d=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));d.users=d.users||{};d.sessions=d.sessions||{};d.streamers=Array.isArray(d.streamers)?d.streamers:[];d.streamers=d.streamers.map(s=>({...s,active:s.active!==false}));return d}
  catch{return {users:{},sessions:{},streamers:[]}}
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

// Закрытая панель владельца. URL не показывается в интерфейсе сайта.
app.get(ADMIN_ROUTE,(req,res)=>{
  res.cookie('blitz_master_admin','1',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:365*24*60*60*1000});
  res.sendFile(path.join(__dirname,'admin-panel-OPROS.html'));
});
app.get('/admin.html',(req,res)=>res.redirect(ADMIN_ROUTE));
app.get('/api/me',(req,res)=>{const {d,u}=requireUser(req,res);if(!u)return res.json({authorized:false});res.json({authorized:true,id:u.id,name:u.name||'Игрок',admin:!!u.admin,stats:makeStats(d,u)})});
app.get('/api/streamers',(req,res)=>{const d=readData();res.json(d.streamers.map((s,index)=>({...s,index})).filter(s=>s.active!==false))});
app.get('/api/stats',(req,res)=>{res.set('Cache-Control','no-store');res.json(aggregateStats(readData()))});

// Простая авторизация: кнопка сразу создаёт аккаунт и выдаёт случайный ID.
app.post('/api/register',(req,res)=>{const d=readData();const id=randomUserId(d);const u={id,name:'Игрок #'+id,attempts:0,correct:0,streamers:{},admin:false,createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()};d.users[String(id)]=u;const sid=sessionId();d.sessions[sid]={id,createdAt:new Date().toISOString()};writeData(d);setSession(res,sid);res.json({authorized:true,id,name:u.name,admin:false,stats:makeStats(d,u)})});
app.post('/api/logout',(req,res)=>{const d=readData(),sid=getSessionId(req);if(sid)delete d.sessions[sid];writeData(d);res.clearCookie('blitz_session');res.json({ok:true})});
app.post('/api/attempt',(req,res)=>{const {d,u}=requireUser(req,res);if(!u)return res.status(401).json({error:'Авторизуйтесь'});if(u.admin)return res.json({ok:true,stats:makeStats(d,u),global:aggregateStats(d)});const i=Number(req.body?.streamerIndex);if(!Number.isInteger(i)||!d.streamers[i])return res.status(400).json({error:'Стример не найден'});const total=Array.isArray(d.streamers[i].questions)?d.streamers[i].questions.length:0;const correct=Math.max(0,Math.min(total,Number(req.body?.correct)||0));normalizeUser(u);u.attempts++;u.correct+=correct;u.streamers[String(i)]??={attempts:0,correct:0};u.streamers[String(i)].attempts++;u.streamers[String(i)].correct+=correct;u.lastSeen=new Date().toISOString();writeData(d);res.json({ok:true,stats:makeStats(d,u),global:aggregateStats(d)})});

app.get('/api/admin',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const {d}=x;res.json({streamers:d.streamers.map((s,index)=>({...s,index})),users:Object.values(d.users).map(normalizeUser).filter(u=>!u.admin).map(publicUser),admins:Object.values(d.users).map(normalizeUser).filter(u=>u.admin).map(publicUser),global:aggregateStats(d),masterRoute:ADMIN_ROUTE})});
app.put('/api/admin/streamers/:index',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const {d}=x,i=Number(req.params.index);if(!d.streamers[i])return res.status(404).json({error:'Не найдено'});const old=d.streamers[i],b=req.body||{};d.streamers[i]={name:String(b.name??old.name),image:String(b.image??old.image),active:b.active!==false,questions:Array.isArray(b.questions)?b.questions.map(q=>({q:String(q.q||''),answers:Array.isArray(q.answers)?q.answers.slice(0,4).map(v=>String(v??'')):['','','',''],correct:Math.max(0,Math.min(3,Number(q.correct)||0))})):old.questions};writeData(d);res.json({ok:true})});
app.post('/api/admin/grant',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.body?.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);u.admin=true;writeData(d);res.json({ok:true,user:publicUser(u)})});
app.post('/api/admin/revoke',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.body?.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);u.admin=false;writeData(d);res.json({ok:true,user:publicUser(u)})});
app.get('/api/admin/user/:id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.params.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);res.json({...publicUser(u),createdAt:u.createdAt,lastSeen:u.lastSeen,streamers:u.streamers})});
app.post('/api/admin/reset/:id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.params.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);u.attempts=0;u.correct=0;u.streamers={};u.lastSeen=new Date().toISOString();writeData(d);res.json({ok:true,user:publicUser(u)})});
app.post('/api/admin/ban/:id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.params.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});const u=normalizeUser(d.users[id]);u.banned=true;Object.entries(d.sessions).forEach(([sid,s])=>{if(String(s.id)===id)delete d.sessions[sid]});writeData(d);res.json({ok:true})});
app.post('/api/admin/unban/:id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,id=String(Number(req.params.id));if(!hasUser(d,id))return res.status(404).json({error:'Такого ID нет'});d.users[id].banned=false;writeData(d);res.json({ok:true})});
app.post('/api/admin/change-id',(req,res)=>{const x=requireAdmin(req,res);if(!x)return;const d=x.d,oldId=String(Number(req.body?.oldId)),newId=Number(req.body?.newId);if(!hasUser(d,oldId))return res.status(404).json({error:'Старого ID нет'});if(!Number.isInteger(newId)||newId<0||newId>100000)return res.status(400).json({error:'Новый ID должен быть 0–100000'});if(hasUser(d,String(newId)))return res.status(409).json({error:'Новый ID уже занят'});const u=d.users[oldId];u.id=newId;u.name='Игрок #'+newId;d.users[String(newId)]=u;delete d.users[oldId];for(const sid of Object.keys(d.sessions)){if(String(d.sessions[sid].id)===oldId)d.sessions[sid].id=newId}writeData(d);res.json({ok:true,user:publicUser(u)})});


app.listen(PORT,()=>{console.log('БЛИЦ: http://localhost:'+PORT);console.log('SECRET ADMIN URL: '+BASE_ADMIN_URL())});
function BASE_ADMIN_URL(){const base=(process.env.BASE_URL||`http://localhost:${PORT}`).replace(/\/$/,'');return base+ADMIN_ROUTE}
