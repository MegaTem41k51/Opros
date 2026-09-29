const express=require("express");
const cookieParser=require("cookie-parser");
const fs=require("fs");
const path=require("path");

const app=express();
const PORT=process.env.PORT || 3000;
const DATA_FILE=path.join(__dirname,"data.json");
const ADMIN_ID=67;

app.use(express.json({limit:"1mb"}));
app.use(cookieParser());
app.use(express.static(__dirname));

function readData(){
  try{return JSON.parse(fs.readFileSync(DATA_FILE,"utf8"))}
  catch{return {users:{},streamers:[]}}
}
function writeData(data){
  fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2),"utf8");
}
function getCookieId(req){
  const value=req.cookies.blitz_id;
  if(value===undefined) return null;
  const id=Number(value);
  if(!Number.isInteger(id)||id<0||id>100000) return null;
  return id;
}
function setId(res,id){
  res.cookie("blitz_id",String(id),{
    httpOnly:true,
    sameSite:"lax",
    secure:process.env.NODE_ENV==="production",
    maxAge:365*24*60*60*1000
  });
}
function authorized(req){
  const id=getCookieId(req);
  if(id===null) return false;
  const data=readData();
  return Object.prototype.hasOwnProperty.call(data.users,String(id));
}

app.get("/api/me",(req,res)=>{
  const id=getCookieId(req);
  const data=readData();
  if(id===null || !data.users[String(id)]){
    return res.json({authorized:false});
  }
  const user=data.users[String(id)];
  res.json({authorized:true,id,admin:id===ADMIN_ID,stats:user});
});

app.post("/api/register",(req,res)=>{
  const raw=req.body?.id;
  if(raw===undefined || raw===null || String(raw).trim()===""){
    return res.status(400).json({error:"Введите ID"});
  }

  const text=String(raw).trim();
  if(!/^\d+$/.test(text)){
    return res.status(400).json({error:"ID должен содержать только число"});
  }

  const id=Number(text);
  if(!Number.isInteger(id)||id<0||id>100000){
    return res.status(400).json({error:"ID должен быть от 0 до 100000"});
  }

  const data=readData();

  if(id===ADMIN_ID){
    return res.status(409).json({error:"Этот ID уже есть"});
  }

  if(Object.prototype.hasOwnProperty.call(data.users,String(id))){
    return res.status(409).json({error:"Уже есть такой ID"});
  }

  data.users[String(id)]={
    attempts:0,
    correct:0,
    createdAt:new Date().toISOString(),
    lastSeen:new Date().toISOString()
  };
  writeData(data);
  setId(res,id);
  res.json({ok:true,id,admin:false});
});

app.post("/api/logout",(req,res)=>{
  res.clearCookie("blitz_id");
  res.json({ok:true});
});

app.get("/api/streamers",(req,res)=>{
  res.json(readData().streamers);
});

app.post("/api/attempt",(req,res)=>{
  const id=getCookieId(req);
  const data=readData();

  if(id===null || !data.users[String(id)]){
    return res.status(401).json({error:"Сначала авторизуйтесь"});
  }

  if(id===ADMIN_ID){
    return res.status(403).json({error:"Админский аккаунт не участвует в статистике"});
  }

  const correct=Math.max(0,Number(req.body?.correct)||0);
  const user=data.users[String(id)];

  user.attempts=(user.attempts||0)+1;
  user.correct=(user.correct||0)+correct;
  user.lastSeen=new Date().toISOString();

  writeData(data);
  res.json({ok:true});
});

function isAdmin(req){
  return getCookieId(req)===ADMIN_ID && authorized(req);
}

app.get("/api/admin",(req,res)=>{
  if(!isAdmin(req)){
    return res.status(403).json({error:"Доступ только для ID 67"});
  }

  const data=readData();
  const users=Object.entries(data.users)
    .filter(([id])=>Number(id)!==ADMIN_ID)
    .map(([id,user])=>({id:Number(id),...user}));

  res.json({streamers:data.streamers,users});
});

app.put("/api/admin/streamers/:index",(req,res)=>{
  if(!isAdmin(req)){
    return res.status(403).json({error:"Доступ только для ID 67"});
  }

  const data=readData();
  const index=Number(req.params.index);

  if(!data.streamers[index]){
    return res.status(404).json({error:"Стример не найден"});
  }

  const body=req.body||{};
  const questions=Array.isArray(body.questions)
    ? body.questions.map(q=>({
        q:String(q.q||""),
        answers:Array.isArray(q.answers)
          ? q.answers.slice(0,4).map(a=>String(a??""))
          : ["","","",""],
        correct:Math.max(0,Math.min(3,Number(q.correct)||0))
      }))
    : data.streamers[index].questions;

  data.streamers[index]={
    name:String(body.name??data.streamers[index].name),
    image:String(body.image??data.streamers[index].image),
    questions
  };

  writeData(data);
  res.json({ok:true});
});

app.listen(PORT,()=>console.log(`БЛИЦ запущен: http://localhost:${PORT}`));