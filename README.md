# БЛИЦ — Twitch авторизация

## Авторизация
Пользователь входит через Twitch OAuth. Сервер получает Twitch user ID и login; email и другие лишние данные не сохраняются.

Обычным пользователям назначается случайный внутренний ID 0–100000, при этом ID 67 зарезервирован под админский Twitch-аккаунт.

Аадмин определяется сервером по `ADMIN_TWITCH_LOGIN` (по умолчанию `HOLLYMMOLLY29`), а не по введённому ID. Поэтому никто не может получить админку, просто создав аккаунт с ID 67.

## Переменные окружения
На Render добавь:
- `TWITCH_CLIENT_ID` — Client ID твоего Twitch Developer приложения
- `TWITCH_CLIENT_SECRET` — Client Secret; хранить только на сервере
- `BASE_URL` — адрес сайта, например `https://example.onrender.com`
- `TWITCH_REDIRECT_URI` — `https://example.onrender.com/auth/twitch/callback`
- `SESSION_SECRET` — длинная случайная строка
- `ADMIN_TWITCH_LOGIN` — `HOLLYMMOLLY29`

В Twitch Developer Console OAuth Redirect URL должен точно совпадать с `TWITCH_REDIRECT_URI`.

Запуск: `npm install` → `npm start`.
