БЛИЦ V2

В ZIP добавлена серверная авторизация без имени/email/пароля. Пользователю создаётся случайный ID и cookie. Статистика хранит только ID, дату, количество прохождений и правильных ответов.

Render:
Build Command: npm install
Start Command: npm start
Environment Variable:
ADMIN_ID=YfgCW60upQbKyZ0GFdDTlQ4u

Админка: /api/admin/login/ADMIN_ID
Сгенерированный ADMIN_ID: YfgCW60upQbKyZ0GFdDTlQ4u
Не публикуй его. После первого деплоя можешь заменить его в Render на свой секретный ID.

ВАЖНО: data.json хранится на диске. Для Render нужен Persistent Disk, иначе данные могут сброситься при новом деплое/перезапуске.
