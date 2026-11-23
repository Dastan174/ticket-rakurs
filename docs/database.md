# База данных

Supabase, Postgres 17. Схема — только через миграции в `supabase/migrations/`.

## Таблицы

| Таблица | Что хранит | Кто читает |
|---|---|---|
| `venues` | Площадки (название, адрес, координаты) | Все |
| `venue_layouts` | Версии схемы площадки, `params` — JSON по [venue-format.md](venue-format.md), `scene_url` — файл в R2 | Все |
| `seats` | Места версии площадки с координатами, `view_limited` — ограниченный обзор | Все |
| `events` | События: название, категория, даты, лимит на человека, правила возврата | Все, только `published` |
| `price_zones` | Ценовые зоны события, цена в сомах | Все (опубликованные события) |
| `event_seats` | Статус каждого места на событии | Все, но только колонки `event_id, seat_id, zone_id, status` |
| `orders`, `order_items` | Заказы и их места | Только владелец |
| `tickets` | Билеты с кодом для QR | Только владелец |
| `profiles` | Имя, телефон, роль | Только сам пользователь; роль меняет админ |
| `organizers`, `audit_log` | Организаторы, журнал действий | Только сервер |

Карту мест для схемы отдаёт `event_seat_map(event_id)`: `{ids, status, zone}`, по символу на место в порядке `seat_id` (88 КБ без сжатия на 10 592 места, большая часть — id). Она же считает просроченную бронь свободной.

Писать в `event_seats`, `orders`, `order_items`, `tickets` клиент не может вообще — только через функции из [booking.md](booking.md).

## Правила миграций

1. Новый файл: `supabase/migrations/<YYYYMMDDHHMMSS>_<что_делает>.sql`. Применённые миграции не редактируем.
2. Каждая новая таблица — `enable row level security` + политики. Служебные таблицы без политик (доступ только серверу) — нормально.
3. Функции с правами: `security definer`, `set search_path = public`, проверка `auth.uid()`, `revoke … from public, anon`, `grant` нужной роли.
4. Деньги — `int` (сомы). Время — `timestamptz`.
5. Расширения, которых нет в PGlite (pg_cron, схема `realtime`), — под условием, как в `20261123000002_jobs_realtime.sql`, иначе упадут тесты.
6. После изменения схемы: `npm test -- tests/db`, затем `npm run db:types`.

## Локально

```bash
npm run db:start    # поднимает Supabase в Docker, печатает URL и ключи
npm run db:reset    # пересоздаёт БД из миграций
npm run db:types    # обновляет src/lib/supabase/database.types.ts
```

Тесты (`npm test`) Docker не требуют: они используют PGlite.
