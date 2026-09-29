const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const ADMIN_ID = process.env.ADMIN_ID || fs.readFileSync(path.join(__dirname, "ADMIN_ID.txt"), "utf8").trim();

app.use(express.json({limit: "1mb"}));
app.use(cookieParser());
app.use(express.static(__dirname));

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return {streamers: [], users: {}}; }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}
function newId(prefix="USR") {
  return prefix + "-" + crypto.randomBytes(10).toString("hex").toUpperCase();
}
function ensureUser(req, res) {
  let id = req.cookies.blitz_uid;
  if (!id || id === ADMIN_ID) {
    id = newId();
    res.cookie("blitz_uid", id, {httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production", maxAge:1000*60*60*24*365});
  }
  const data = readData();
  if (!data.users[id]) data.users[id] = {attempts: 0, correct: 0, lastSeen: new Date().toISOString()};
  data.users[id].lastSeen = new Date().toISOString();
  writeData(data);
  return id;
}
function admin(req) {
  return req.headers["x-admin-id"] === ADMIN_ID;
}

app.get("/api/auth", (req,res) => {
  const id = ensureUser(req,res);
  res.json({id, admin:false});
});
app.get("/api/me", (req,res) => {
  const id = ensureUser(req,res);
  const data = readData();
  res.json({id, stats:data.users[id] || {attempts:0,correct:0}});
});
app.get("/api/streamers", (req,res) => {
  const data = readData();
  res.json(data.streamers);
});
app.post("/api/attempt", (req,res) => {
  const id = ensureUser(req,res);
  const {correct, total} = req.body || {};
  const data = readData();
  if (!data.users[id]) data.users[id] = {attempts:0,correct:0,lastSeen:new Date().toISOString()};
  data.users[id].attempts += 1;
  data.users[id].correct += Number(correct) || 0;
  data.users[id].lastSeen = new Date().toISOString();
  writeData(data);
  res.json({ok:true, id, correct:Number(correct)||0, total:Number(total)||0});
});

app.post("/api/admin/login", (req,res) => {
  if (req.body?.id !== ADMIN_ID) return res.status(401).json({error:"Неверный ID"});
  res.json({ok:true});
});
app.get("/api/admin", (req,res) => {
  if (!admin(req)) return res.status(401).json({error:"Нет доступа"});
  const data = readData();
  const users = Object.entries(data.users).map(([id,v]) => ({id,...v}));
  res.json({streamers:data.streamers, users});
});
app.put("/api/admin/streamers/:index", (req,res) => {
  if (!admin(req)) return res.status(401).json({error:"Нет доступа"});
  const index = Number(req.params.index);
  const data = readData();
  if (!data.streamers[index]) return res.status(404).json({error:"Стример не найден"});
  const incoming = req.body || {};
  data.streamers[index] = {
    name: String(incoming.name ?? data.streamers[index].name),
    image: String(incoming.image ?? data.streamers[index].image),
    questions: Array.isArray(incoming.questions) ? incoming.questions.map(q => ({
      q: String(q.q || ""),
      answers: Array.isArray(q.answers) ? q.answers.slice(0,4).map(a=>String(a||"")) : ["","","",""],
      correct: Math.max(0, Math.min(3, Number(q.correct)||0))
    })) : data.streamers[index].questions
  };
  writeData(data);
  res.json(data.streamers[index]);
});
app.listen(PORT, () => console.log(`БЛИЦ запущен: http://localhost:${PORT}`));
