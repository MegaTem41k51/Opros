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
function writeData(data){fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2),"utf8")}
function getId(req){
  const n=Number(req.cookies.blitz_id);
  return Number.isInteger(n)&&n>=0&&n<=100000?n:null;
}
function setId(res,id){
  res.cookie("blitz_id",String(id),{
    httpOnly:true,sameSite:"lax",
    secure:process.env.NODE_ENV==="production",
    maxAge:365*24*60*60*1000
  });
}
function hasUser(data,id){return Object.prototype.hasOwnProperty.call(data.users,String(id))}

app.get("/api/me",(req,res)=>{
  const id=getId(req),data=readData();
  if(id===null || !hasUser(data,id)) return res.json({authorized:false});
  res.json({authorized:true,id,admin:id===ADMIN_ID,stats:data.users[String(id)]});
});

app.post("/api/login",(req,res)=>{
  const raw=String(req.body?.id ?? "").trim();
  if(!/^\d+$/.test(raw)) return res.status(400).json({error:"Введите ID"});
  const id=Number(raw);
  if(id<0||id>100000) return res.status(400).json({error:"Неверный ID"});

  const data=readData();

  if(hasUser(data,id)){
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
  res.json({ok:true,id,admin:id===ADMIN_ID});
});

app.post("/api/logout",(req,res)=>{res.clearCookie("blitz_id");res.json({ok:true})});

app.get("/api/streamers",(req,res)=>res.json(readData().streamers));

app.post("/api/attempt",(req,res)=>{
  const id=getId(req),data=readData();
  if(id===null || !hasUser(data,id)) return res.status(401).json({error:"Авторизуйтесь"});
  if(id===ADMIN_ID) return res.json({ok:true});

  const user=data.users[String(id)];
  user.attempts=(user.attempts||0)+1;
  user.correct=(user.correct||0)+(Number(req.body?.correct)||0);
  user.lastSeen=new Date().toISOString();
  writeData(data);
  res.json({ok:true});
});

function isAdmin(req){
  const id=getId(req);
  return id===ADMIN_ID && hasUser(readData(),id);
}

app.get("/api/admin",(req,res)=>{
  if(!isAdmin(req)) return res.status(403).json({error:"Нет доступа"});
  const d=readData();
  res.json({
    streamers:d.streamers,
    users:Object.entries(d.users)
      .filter(([id])=>Number(id)!==ADMIN_ID)
      .map(([id,v])=>({id:Number(id),...v}))
  });
});

app.put("/api/admin/streamers/:index",(req,res)=>{
  if(!isAdmin(req)) return res.status(403).json({error:"Нет доступа"});
  const d=readData(),i=Number(req.params.index);
  if(!d.streamers[i]) return res.status(404).json({error:"Не найдено"});
  const b=req.body||{};
  d.streamers[i]={
    name:String(b.name??d.streamers[i].name),
    image:String(b.image??d.streamers[i].image),
    questions:Array.isArray(b.questions)?b.questions.map(q=>({
      q:String(q.q||""),
      answers:Array.isArray(q.answers)?q.answers.slice(0,4).map(x=>String(x??"")):["","","",""],
      correct:Math.max(0,Math.min(3,Number(q.correct)||0))
    })):d.streamers[i].questions
  };
  writeData(d);
  res.json({ok:true});
});

app.listen(PORT,()=>console.log("БЛИЦ: http://localhost:"+PORT));