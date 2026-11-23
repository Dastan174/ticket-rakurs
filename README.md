# Ракурс

Билеты на концерты, театр и спорт в Бишкеке. Перед покупкой можно сесть на выбранное место в 3D, осмотреться и пройтись по залу.

**Статус:** этап 1 — каталог и выбор мест работают на Supabase, дальше вход и бронь. План — [docs/roadmap.md](docs/roadmap.md).

## Быстрый старт

```bash
npm install
npm run db:start             # локальный Supabase в Docker, печатает URL и ключи
cp .env.example .env.local   # вписать URL, publishable и secret ключи из вывода db:start
npm run db:load-demo         # демо-площадки и события
npm run dev                  # http://localhost:3000
```

Открой событие, покрути зал, дважды кликни по креслу — камера сядет на это место. Дальше: мышь или палец — осмотреться, WASD или стрелки — идти, Esc — назад.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Сервер разработки |
| `npm test` | Все тесты, включая SQL-тесты брони на PGlite |
| `npm run typecheck` / `npm run lint` | Проверка типов и линтер |
| `npm run build` | Сборка Next.js |
| `npm run preview` | Сборка под Cloudflare Workers и локальный запуск |
| `npm run deploy` | Деплой на Cloudflare |
| `npm run db:start` | Локальный Supabase (нужен Docker) |
| `npm run db:reset` | Пересоздать локальную БД из миграций |
| `npm run db:load-demo` | Загрузить демо-площадки и события |
| `npm run db:types` | Сгенерировать TypeScript-типы БД |

## Стек

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Three.js · Supabase (Postgres, Auth, Realtime, pg_cron) · Cloudflare Workers + R2 (через OpenNext) · Vitest + PGlite.

## Документация

- [docs/README.md](docs/README.md) — оглавление
- [docs/product/tz.html](docs/product/tz.html) — техническое задание
- [AGENTS.md](AGENTS.md) — правила для разработчиков и ИИ-агентов
