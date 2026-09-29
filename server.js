const express=require("express");
const cookieParser=require("cookie-parser");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const app=express();
const PORT=process.env.PORT||3000;
const DATA=path.join(__dirname,"data.json");
const ADMIN_ID=67;
app.use(express.json({limit:"1mb"}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname,"public")));
function read(){return JSON.parse(fs.readFileSync(DATA,"utf8"))}
function write(d){fs.writeFileSync(DATA,JSON.stringify(d,null,2))}
function userFrom(req){const id=Number(req.cookies.blitz_id);return Number.isInteger(id)&&id>=0&&id<=100000?id:null}
function cookie(res,id){res.cookie("blitz_id",String(id),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:31536000000})}
function freeId(d){
  const used=new Set([...(d.reservedIds||[]),...Object.keys(d.users).map(Number)]);
  const free=[];
  for(let i=0;i<=100000;i++) if(!used.has(i)) free.push(i);
  if(!free.length) throw new Error("Все ID заняты");
  return free[crypto.randomInt(0,free.length)];
}
app.get("/api/me",(req,res)=>{
  const d=read(); const id=userFrom(req);
  if(id===null || (!d.users[id] && id!==ADMIN_ID)) return res.json({authorized:false});
  res.json({authorized:true,id,admin:id===ADMIN_ID,stats:d.users[id]||{attempts:0,correct:0}});
});
app.post("/api/login",(req,res)=>{
  const d=read();
  const existing=userFrom(req);
  if(existing!==null && (existing===ADMIN_ID||d.users[existing])) return res.json({ok:true,id:existing,admin:existing===ADMIN_ID});
  const id=freeId(d);
  d.users[id]={attempts:0,correct:0,createdAt:new Date().toISOString()};
  write(d); cookie(res,id);
  res.json({ok:true,id,admin:false});
});
app.post("/api/logout",(req,res)=>{res.clearCookie("blitz_id");res.json({ok:true})});
app.get("/api/streamers",(req,res)=>res.json(read().streamers));
app.post("/api/attempt",(req,res)=>{
  const d=read(),id=userFrom(req);
  if(id===null||id===ADMIN_ID||!d.users[id]) return res.status(401).json({error:"Нужна авторизация"});
  const correct=Math.max(0,Number(req.body.correct)||0);
  d.users[id].attempts++; d.users[id].correct+=correct; d.users[id].lastSeen=new Date().toISOString();
  write(d); res.json({ok:true});
});
function isAdmin(req){return userFrom(req)===ADMIN_ID}
app.get("/api/admin",(req,res)=>{
 if(!isAdmin(req)) return res.status(403).json({error:"Доступ только для ID 67"});
 const d=read(); res.json({streamers:d.streamers,users:Object.entries(d.users).map(([id,v])=>({id:Number(id),...v}))});
});
app.put("/api/admin/streamers/:i",(req,res)=>{
 if(!isAdmin(req)) return res.status(403).json({error:"Доступ только для ID 67"});
 const d=read(),i=Number(req.params.i);
 if(!d.streamers[i]) return res.status(404).json({error:"Не найдено"});
 const x=req.body;
 d.streamers[i]={name:String(x.name||""),image:String(x.image||""),questions:Array.isArray(x.questions)?x.questions.map(q=>({q:String(q.q||""),answers:Array.isArray(q.answers)?q.answers.slice(0,4).map(String):["","","",""],correct:Math.max(0,Math.min(3,Number(q.correct)||0))})):[]};
 write(d);res.json({ok:true});
});
app.listen(PORT,()=>console.log("БЛИЦ: http://localhost:"+PORT));