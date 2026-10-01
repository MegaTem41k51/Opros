# БЛИЦ — вход через Twitch OAuth

Кнопка «Войти через Twitch» открывает официальный Twitch OAuth. Пользователь не вводит Twitch ID: после успешного входа сервер получает Twitch user ID и login и сам создаёт/находит аккаунт БЛИЦ.

> Twitch официально использует endpoint `https://id.twitch.tv/oauth2/authorize` для OAuth-авторизации. URL `https://auth.twitch.tv/authorize` не является документированным endpoint для этого flow. citeturn0search0

## Переменные Render

Добавь в Environment Variables:

- `TWITCH_CLIENT_ID` — Client ID твоего Twitch-приложения
- `TWITCH_CLIENT_SECRET` — Client Secret твоего Twitch-приложения
- `BASE_URL` — полный адрес сайта, например `https://example.onrender.com`
- `TWITCH_REDIRECT_URI` — `https://example.onrender.com/auth/twitch/callback`
- `SESSION_SECRET` — длинная случайная строка
- `ADMIN_TWITCH_LOGIN` — Twitch login администратора, по умолчанию `HOLLYMMOLLY29`

В Twitch Developer Console Redirect URL должен точно совпадать с `TWITCH_REDIRECT_URI`.

## Как работает

1. Пользователь нажимает «Войти через Twitch».
2. Сервер перенаправляет его на официальный Twitch OAuth.
3. Twitch возвращает `code` на `/auth/twitch/callback`.
4. Сервер обменивает code на access token и запрашивает Twitch profile.
5. Внутренний ID БЛИЦ создаётся автоматически случайным числом 0–100000. ID `67` закреплён за администратором.
6. Access token не записывается в `data.json`.

## Запуск

```bash
npm install
npm start
```


### Вход через Twitch
Кнопка «Войти через Twitch» открывает официальный Twitch OAuth Authorization Code Flow: `https://id.twitch.tv/oauth2/authorize`. Twitch сам определяет аккаунт пользователя; Twitch ID вручную вводить не нужно.

Для работы необходим зарегистрированный Twitch Client ID и Client Secret. Secret хранится только на сервере. Redirect URI в Twitch должен точно совпадать с `TWITCH_REDIRECT_URI`.

Для администратора рекомендуется задать `ADMIN_TWITCH_USER_ID` — это Twitch user ID администратора. `ADMIN_TWITCH_LOGIN` оставлен как резервный вариант.
