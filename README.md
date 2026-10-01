# БЛИЦ — STREAMER QUIZ

Версия без Twitch OAuth. Twitch Developer Console, Client ID, Client Secret и 2FA для входа больше не нужны.

## Вход
- Пользователь регистрируется с ником и паролем.
- Сервер автоматически выдаёт случайный ID от 0 до 100000.
- ID 67 зарезервирован для администратора.
- Ник администратора по умолчанию: `HOLLYMMOLLY29`.
- Для администратора задай `ADMIN_PASSWORD` в Render. Ник `HOLLYMMOLLY29` нельзя занять другим паролем.
- Пароли хранятся как scrypt-хеши, а сессия — в HttpOnly cookie.
- Админка проверяется сервером.

## Render Environment Variables
Рекомендуется задать:
- `SESSION_SECRET` — длинная случайная строка.
- `ADMIN_PASSWORD` — секретный пароль администратора.

Больше не нужны:
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_REDIRECT_URI`
- `ADMIN_TWITCH_LOGIN`

## Запуск
```bash
npm install
npm start
```
Все файлы находятся непосредственно в корне проекта.
