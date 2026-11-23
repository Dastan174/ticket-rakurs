# Деплой и окружение

Ничего из этого пока не создано: этапы ниже выполняются один раз при запуске.

## Переменные

Шаблон — `.env.example`. Локально — `.env.local`, на Cloudflare — секреты воркера.

| Переменная | Где | Откуда |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | браузер и сервер | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | браузер и сервер | Supabase → API Keys → publishable |
| `SUPABASE_SECRET_KEY` | **только сервер** | Supabase → API Keys → secret |
| `NEXT_PUBLIC_ASSETS_URL` | браузер | Публичный адрес бакета R2 |

## Supabase

1. Создать проект (регион ближе к Бишкеку — Frankfurt). План: Free на разработку, Pro ($25) к первым продажам — у Free нет бэкапов и проект засыпает.
2. Связать и применить миграции:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. Загрузить демо-данные (по желанию): прописать в `.env.local` URL и секретный ключ удалённого проекта и выполнить `npm run db:load-demo`.
4. Проверить, что `pg_cron` включён (Database → Extensions) и задача `expire-holds` есть в `cron.job`.
5. Auth: включить e-mail OTP, настроить SMTP (Amazon SES или Brevo), позже вход через Telegram.

## Cloudflare

1. Войти: `npx wrangler login`.
2. Создать бакеты:
   ```bash
   npx wrangler r2 bucket create rakurs-opennext-cache
   npx wrangler r2 bucket create rakurs-assets
   ```
   Для `rakurs-assets` включить публичный доступ (свой домен или r2.dev) — это `NEXT_PUBLIC_ASSETS_URL`.
3. Секреты воркера:
   ```bash
   npx wrangler secret put SUPABASE_SECRET_KEY
   ```
   Публичные `NEXT_PUBLIC_*` нужны на этапе сборки — задать их в окружении CI или в `.env.production`.
4. Деплой: `npm run deploy`. Локальная проверка того же билда: `npm run preview`.

OpenNext официально не поддерживает сборку на Windows (работает, но с предупреждением). Продакшен-деплой — из GitHub Actions на Linux или из WSL.

## Перед горячими продажами

- Поднять мощность базы Supabase (Large) за пару часов до старта, вернуть после.
- Прогнать k6 на staging-копии.
- Проверить алерты и что `expire-holds` работает.

Стоимость по тарифам — [ТЗ, раздел 8а](product/tz.html).
