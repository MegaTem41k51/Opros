const express=require("express");
const cookieParser=require("cookie-parser");
const fs=require("fs");
const path=require("path");

const app=express();
const PORT=process.env.PORT||3000;
const DATA_FILE=path.join(__dirname,"data.json");
const ADMIN_ID=67;

app.use(express.json({limit:"1mb"}));
app.use(cookieParser());
app.use(express.static(__dirname));

function readData(){
  try{
    const d=JSON.parse(fs.readFileSync(DATA_FILE,"utf8"));
    d.users=d.users||{};
    d.streamers=Array.isArray(d.streamers)?d.streamers:[];
    d.streamers=d.streamers.map(s=>({...s,active:s.active!==false}));
    return d;
  }catch{return {users:{},streamers:[]}}
}
function writeData(data){fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2),"utf8")}
function getId(req){
  const n=Number(req.cookies.blitz_id);
  return Number.isInteger(n)&&n>=0&&n<=100000?n:null;
}
function setId(res,id){
  res.cookie("blitz_id",String(id),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:365*24*60*60*1000});
}
function hasUser(data,id){return Object.prototype.hasOwnProperty.call(data.users,String(id))}
function normalizeUser(user){
  user.attempts=user.attempts||0;
  user.correct=user.correct||0;
  user.streamers=user.streamers||{};
  return user;
}
function makeMeStats(data,id){
  const user=normalizeUser(data.users[String(id)]);
  const streamerStats=data.streamers.map((s,index)=>{
    const st=user.streamers[String(index)]||{attempts:0,correct:0};
    return {index,name:s.name,attempts:st.attempts||0,correct:st.correct||0,hidden:s.active===false};
  }).filter(s=>!s.hidden||s.attempts>0);
  return {...user,streamers:streamerStats};
}
function aggregateStats(data){
  const users=Object.entries(data.users).filter(([id])=>Number(id)!==ADMIN_ID);
  let attempts=0,correct=0;
  const streamerMap={};
  const players=[];
  users.forEach(([id,raw])=>{
    const u=normalizeUser(raw);
    attempts+=Number(u.attempts)||0;
    correct+=Number(u.correct)||0;
    players.push({id:Number(id),attempts:Number(u.attempts)||0,correct:Number(u.correct)||0});
    Object.entries(u.streamers||{}).forEach(([index,st])=>{
      if(!streamerMap[index]) streamerMap[index]={attempts:0,correct:0};
      streamerMap[index].attempts+=Number(st.attempts)||0;
      streamerMap[index].correct+=Number(st.correct)||0;
    });
  });
  players.sort((a,b)=>b.correct-a.correct||b.attempts-a.attempts||a.id-b.id);
  const streamers=data.streamers.map((s,index)=>({
    index,name:s.name,image:s.image,active:s.active!==false,
    attempts:streamerMap[String(index)]?.attempts||0,
    correct:streamerMap[String(index)]?.correct||0
  })).filter(s=>s.active||s.attempts>0);
  streamers.sort((a,b)=>b.attempts-a.attempts||b.correct-a.correct);
  return {players:users.length,attempts,correct,streamers,topPlayers:players.slice(0,8)};
}

app.get("/api/me",(req,res)=>{
  const id=getId(req),data=readData();
  if(id===null||!hasUser(data,id)) return res.json({authorized:false});
  res.json({authorized:true,id,stats:makeMeStats(data,id)});
});

app.post("/api/login",(req,res)=>{
  const raw=String(req.body?.id??"").trim();
  if(!/^\d+$/.test(raw)) return res.status(400).json({error:"Введите ID"});
  const id=Number(raw);
  if(id<0||id>100000) return res.status(400).json({error:"Неверный ID"});
  const data=readData();
  if(hasUser(data,id)) return res.status(409).json({error:"Уже есть такой ID"});
  data.users[String(id)]={attempts:0,correct:0,streamers:{},createdAt:new Date().toISOString(),lastSeen:new Date().toISOString()};
  writeData(data);setId(res,id);
  res.json({ok:true,id,stats:makeMeStats(data,id)});
});
app.post("/api/logout",(req,res)=>{res.clearCookie("blitz_id");res.json({ok:true})});

app.get("/api/streamers",(req,res)=>{
  const d=readData();
  res.json(d.streamers.map((s,index)=>({...s,index})).filter(s=>s.active!==false));
});

app.get("/api/stats",(req,res)=>{res.set("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");res.set("Pragma","no-cache");res.set("Expires","0");res.json(aggregateStats(readData()));});

function currentQuestions(data,index){return Array.isArray(data.streamers[index]?.questions)?data.streamers[index].questions.length:0}

app.post("/api/attempt",(req,res)=>{
  const id=getId(req),data=readData();
  if(id===null||!hasUser(data,id)) return res.status(401).json({error:"Авторизуйтесь"});
  if(id===ADMIN_ID) return res.json({ok:true});
  const user=normalizeUser(data.users[String(id)]);
  const index=Number(req.body?.streamerIndex);
  if(!Number.isInteger(index)||!data.streamers[index]) return res.status(400).json({error:"Стример не найден"});
  const correct=Math.max(0,Math.min(Number(currentQuestions(data,index)),Number(req.body?.correct)||0));
  user.attempts+=1;user.correct+=correct;
  user.streamers[String(index)]=user.streamers[String(index)]||{attempts:0,correct:0};
  user.streamers[String(index)].attempts+=1;user.streamers[String(index)].correct+=correct;
  user.lastSeen=new Date().toISOString();writeData(data);
  res.json({ok:true,stats:makeMeStats(data,id),global:aggregateStats(data)});
});

function isAdmin(req){const id=getId(req);return id===ADMIN_ID&&hasUser(readData(),id)}
app.get("/api/admin",(req,res)=>{
  if(!isAdmin(req)) return res.status(403).json({error:"Нет доступа"});
  const d=readData();
  res.json({streamers:d.streamers.map((s,index)=>({...s,index})),users:Object.entries(d.users).filter(([id])=>Number(id)!==ADMIN_ID).map(([id,v])=>({id:Number(id),...normalizeUser(v)})),global:aggregateStats(d)});
});
app.put("/api/admin/streamers/:index",(req,res)=>{
  if(!isAdmin(req)) return res.status(403).json({error:"Нет доступа"});
  const d=readData(),i=Number(req.params.index);
  if(!d.streamers[i]) return res.status(404).json({error:"Не найдено"});
  const old=d.streamers[i],b=req.body||{};
  d.streamers[i]={
    name:String(b.name??old.name),image:String(b.image??old.image),active:b.active!==false,
    questions:Array.isArray(b.questions)?b.questions.map(q=>({q:String(q.q||""),answers:Array.isArray(q.answers)?q.answers.slice(0,4).map(x=>String(x??"")):['','','',''],correct:Math.max(0,Math.min(3,Number(q.correct)||0))})):old.questions
  };
  writeData(d);res.json({ok:true});
});

app.listen(PORT,()=>console.log("БЛИЦ: http://localhost:"+PORT));
