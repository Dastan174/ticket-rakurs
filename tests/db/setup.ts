// Общая тестовая БД: PGlite в памяти + те же миграции, что идут в Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(__dirname, "../../supabase/migrations");
export const U1 = "00000000-0000-0000-0000-000000000001";
export const U2 = "00000000-0000-0000-0000-000000000002";

// Минимальная заглушка того, что Supabase создаёт сам.
const SUPABASE_STUB = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

/** Событие на 10 мест в одном ряду: места 1–5 в зоне VIP (5000), 6–10 в «Стандарт» (2500). */
export async function createTestDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).sort()) await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));

  await db.exec(`insert into auth.users values ('${U1}'), ('${U2}')`);
  const { rows } = await db.query<{ id: string }>(`
    with v as (insert into venues (slug, name) values ('arena', 'Арена') returning id),
    l as (insert into venue_layouts (venue_id, version, params) select id, 1, '{}' from v returning id),
    s as (insert into seats (layout_id, sector, row, number, x, y, z)
          select l.id, 1, 1, n, 0, 0, 0 from l, generate_series(1, 10) n returning id, number),
    e as (insert into events (slug, layout_id, title, category, starts_at, published, max_per_user)
          select 'show', id, 'Шоу', 'concert', now() + interval '30 days', true, 6 from l returning id),
    z as (insert into price_zones (event_id, name, price)
          select e.id, v.name, v.price from e, (values ('VIP', 5000), ('Стандарт', 2500)) v(name, price)
          returning id, event_id, price)
    insert into event_seats (event_id, seat_id, zone_id)
    select z.event_id, s.id, z.id from s join z on (s.number <= 5) = (z.price = 5000)
    returning event_id as id`);
  const eventId = rows[0].id;
  const seatIds = (await db.query<{ id: number }>(`select id from seats order by id`)).rows.map((r) => Number(r.id));

  const as = (user: string | null) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? ""]);
  return { db, eventId, seatIds, as };
}
