const streamers=[
 {name:"megarush51",tag:"MEGARUSH51",img:"https://unavatar.io/twitch/megarush51",questions:[
  ["Какой формат лучше всего описывает типичный контент этого стримера?","Игровые стримы","Кулинарные эфиры","Новости науки","Музыкальные концерты",0],
  ["Какая платформа указана для канала megarush51?","Twitch","Kick","YouTube Music","Discord",0],
  ["Что зритель обычно ожидает от игрового блица?","Быстрых вопросов","Длинного фильма","Подкаста на 3 часа","Фотоальбома",0],
  ["Какой вариант является ником выбранного стримера?","megarush51","megarush_15","mega51rush","megarushTV",0],
  ["Что означает «блиц» в этом сайте?","Короткий тест","Длинная лекция","Случайная покупка","Чат поддержки",0],
  ["Сколько вариантов ответа показывается в одном вопросе?","4","2","6","8",0],
  ["Что происходит после последнего вопроса?","Показывается результат","Открывается магазин","Начинается регистрация","Сбрасывается сайт",0],
  ["Можно ли пройти блиц повторно?","Да","Нет","Только ночью","Только один раз",0],
  ["Что показывает прогресс сверху?","Номер вопроса","FPS","Громкость","Количество зрителей",0],
  ["Что можно сделать после результата?","Пройти снова или выбрать другого","Удалить аккаунт","Изменить ник","Выключить интернет",0]
 ]},
 {name:"mmr9i9",tag:"MMR9I9",img:"https://unavatar.io/twitch/mmr9i9",questions:[]},
 {name:"m4ga",tag:"M4GA",img:"https://unavatar.io/twitch/m4ga",questions:[]},
 {name:"realykekss",tag:"REALYKEKSS",img:"https://unavatar.io/twitch/realykekss",questions:[]},
 {name:"emilshe1nru",tag:"EMILSHE1NRU",img:"https://unavatar.io/twitch/emilshe1nru",questions:[]},
 {name:"j05k1y",tag:"J05K1Y",img:"https://unavatar.io/twitch/j05k1y",questions:[]},
 {name:"del1ght",tag:"DEL1GHT",img:"https://unavatar.io/twitch/del1ght",questions:[]}
];

const generic=[
 ["В какой категории чаще всего ищут игровые стримы?","Gaming","Cooking","Travel","Music",0],
 ["Что обычно делает стример во время прямого эфира?","Общается со зрителями","Печатает книгу","Рисует карту города","Проводит экзамен",0],
 ["Что такое Twitch?","Платформа для прямых трансляций","Графический редактор","Музыкальный формат","Браузер",0],
 ["Что помогает зрителям узнать, кто сейчас играет?","Название категории","Погода","Курс валют","Размер экрана",0],
 ["Что такое чат стрима?","Сообщения зрителей в реальном времени","Список файлов","Настройки компьютера","Таблица цен",0],
 ["Что означает «онлайн» у канала?","Идёт трансляция","Канал удалён","Идёт обновление браузера","Страница закрыта",0],
 ["Какой элемент обычно используется для запуска теста?","Кнопка","Пароль Wi‑Fi","QR-сканер","Калькулятор",0],
 ["Что делает результат блица?","Показывает число правильных ответов","Меняет ник стримера","Удаляет вопросы","Создаёт новый канал",0],
 ["Зачем нужен прогресс-бар?","Показывать продвижение по тесту","Менять цвет сайта","Загружать музыку","Скрывать ответы",0],
 ["Можно ли добавить новых стримеров в этот проект?","Да, через данные в app.js","Нет, никогда","Только через BIOS","Только с телефона",0]
];

streamers.forEach(s=>{if(!s.questions.length)s.questions=generic.map(q=>q.slice());});

let current=null, qi=0, score=0, locked=false;
const $=id=>document.getElementById(id);

function renderHome(){
 $("streamers").innerHTML=streamers.map((s,i)=>`
 <article class="streamer" onclick="startQuiz(${i})">
  <div class="photo"><img src="${s.img}" alt="${s.name}" onerror="this.src='https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(s.name)}&backgroundColor=161824&fontFamily=Arial'"><div class="shade"></div></div>
  <div class="streamer-info"><small>STREAMER</small><h3>${s.name}</h3><div class="start">НАЧАТЬ БЛИЦ <span class="arrow">→</span></div></div>
 </article>`).join("");
}
function show(id){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));$(id).classList.add("active");window.scrollTo({top:0,behavior:"smooth"});}
function startQuiz(i){current=streamers[i];qi=0;score=0;locked=false;$("quizName").textContent=current.name;$("quizAvatar").src=current.img;$("qTotal").textContent=current.questions.length;show("quiz");renderQuestion();}
function renderQuestion(){
 const q=current.questions[qi]; locked=false;
 $("qNumber").textContent=qi+1;$("questionIndex").textContent=String(qi+1).padStart(2,"0");$("questionText").textContent=q[0];
 $("progressBar").style.width=((qi+1)/current.questions.length*100)+"%";
 const letters=["A","B","C","D"];
 $("answers").innerHTML=q.slice(1,5).map((a,i)=>`<button class="answer" onclick="answer(${i},this)"><b>${letters[i]}</b><span>${a}</span></button>`).join("");
}
function answer(i,el){
 if(locked)return;locked=true;const q=current.questions[qi], buttons=[...document.querySelectorAll(".answer")];
 buttons.forEach((b,n)=>{if(n===q[5])b.classList.add("correct")});
 if(i===q[5])score++;else el.classList.add("wrong");
 setTimeout(()=>{qi++;if(qi<current.questions.length)renderQuestion();else finish()},650);
}
function finish(){
 $("resultAvatar").src=current.img;$("resultName").textContent=current.name;$("score").textContent=score;
 $("rightCount").textContent=score;$("wrongCount").textContent=current.questions.length-score;
 const p=score/current.questions.length;
 $("resultText").textContent=p===1?"Идеальный результат. Ты знаешь этого стримера наизусть!":p>=.7?"Очень достойно — ты явно следишь за контентом.":p>=.4?"Неплохо, но можно попробовать ещё раз и улучшить результат.":"Похоже, пришло время узнать этого стримера получше.";
 show("result");
}
function restart(){startQuiz(streamers.indexOf(current))}
function goHome(){show("home")}
renderHome();
