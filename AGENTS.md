<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ракурс — правила для ИИ-агентов

Этот файл — единый источник правил для всех агентов (Claude Code, Codex, Cursor, Copilot, Gemini и др.). Файлы `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/`, `.github/copilot-instructions.md` только ссылаются сюда. Правило меняем здесь, а не в копиях.

## Что за проект

Билетный сервис для Бишкека: концерты, театр, спорт, юмор, детям. Главная фича — перед покупкой сесть на выбранное место в 3D и осмотреться. Кино, туризм и другие города — вне объёма.

Команда — 2 разработчика. Бюджет инфраструктуры ≈ $30–45 в месяц. Простое решение лучше «правильного на вырост».

ТЗ: `docs/product/tz.html`. Прототип 3D: `docs/product/prototype.html`. Документация: `docs/README.md`.

## Стек

- Next.js 16 (App Router; Cache Components **выключены** — OpenNext на Cloudflare их пока не поддерживает полностью, см. `next.config.ts`), React 19, TypeScript strict, Tailwind CSS 4
- Хостинг: Cloudflare Workers через `@opennextjs/cloudflare`, файлы и 3D-сцены — Cloudflare R2
- Supabase: Postgres 17, Auth, Realtime, pg_cron, Edge Functions. Своего бэкенд-сервера нет
- 3D: Three.js императивно в клиентском компоненте (не react-three-fiber, см. `docs/decisions/0002-three-imperative.md`)
- Тесты: Vitest, PGlite (Postgres в памяти для SQL), позже Playwright и k6

## Команды

```bash
npm run dev          # http://localhost:3000
npm test             # все тесты (vitest), включая SQL-тесты брони
npm run typecheck
npm run lint
npm run build        # проверка сборки Next.js
npm run preview      # сборка под Cloudflare и локальный запуск в workerd
npm run db:start     # локальный Supabase (нужен Docker)
npm run db:reset     # пересоздать локальную БД из миграций
npm run db:types     # сгенерировать src/lib/supabase/database.types.ts
```

Перед тем как сказать «готово»: `npm run typecheck && npm run lint && npm test`. Если менял страницы — ещё `npm run build`.

## Структура

```
src/app/                  страницы (App Router)
src/components/venue/     3D-зал (VenueViewer)
src/components/booking/   выбор мест, корзина
src/lib/venue/            формат площадки, генерация мест, высота пола — чистые функции
src/lib/supabase/         клиенты Supabase (client.ts — браузер, server.ts — сервер)
src/data/demo.ts          демо-данные до подключения Supabase
supabase/migrations/      SQL-миграции — единственный способ менять схему
tests/                    vitest; tests/db — SQL-тесты на PGlite
docs/                     документация, ТЗ, решения (ADR)
```

## Жёсткие правила

1. **Двойная продажа недопустима.** Статус места меняется только SQL-функциями `hold_seats`, `cancel_order`, `confirm_payment`, `expire_holds`. Никаких `update event_seats` из TypeScript. Любое изменение этих функций — с тестом в `tests/db/booking.test.ts` и ревью по `docs/booking.md`.
2. **Схема БД — только миграциями** в `supabase/migrations/` (новый файл с меткой времени, старые не правим после применения). На каждой новой таблице включён RLS и есть политики.
3. **Секретный ключ Supabase** (`SUPABASE_SECRET_KEY`, `createAdminClient`) — только в серверном коде (webhook оплаты, админка). В клиентских компонентах — только `src/lib/supabase/client.ts`.
4. **Деньги — целые сомы (`int`)**, без float. Время — `timestamptz`.
5. **Next.js 16:** `params`/`searchParams` — Promise; чтение данных запроса держим внутри `<Suspense>` (готовность к включению Cache Components). Не включать `cacheComponents` без проверки `npm run preview`. Сначала читай `node_modules/next/dist/docs/`, а не память.
6. **3D:** сцена создаётся один раз на площадку; смена статусов и выбора только перекрашивает `InstancedMesh`. Никаких отдельных мешей на кресло.
7. **Формат площадки** (`VenueLayout`) меняем вместе с `docs/venue-format.md` и тестами `tests/venue.test.ts`. Порядок мест из `generateSeats` — стабильный: от него зависят id мест.
8. **Без новых зависимостей** без явной причины. Сначала то, что уже есть в проекте и в платформе.
9. **Интерфейс на русском**, позже кыргызский. Код, имена, коммиты — на английском; комментарии и документация — на русском.
10. Бесплатных/дешёвых тарифов не ломать: 3D-сцены и картинки — в R2 (бесплатный трафик), не в Supabase Storage.

## Стиль кода

- Маленькие чистые функции в `src/lib`, компоненты — тонкие.
- Комментарий объясняет «почему», а не «что».
- Ограничение, принятое сознательно, помечаем: `// shortcut: <ограничение>, <когда переделать>`.
- Новая нетривиальная логика (бронь, деньги, парсинг, генерация мест) — с тестом.
- Подробнее: `docs/conventions.md`.

## Git

- Ветки: `feat/…`, `fix/…`, `chore/…`, `docs/…`. В `main` — только через PR.
- Коммиты: Conventional Commits (`feat: …`, `fix: …`), на английском.
- Не коммитить `.env*` (кроме `.env.example`), `.dev.vars`, ключи.
