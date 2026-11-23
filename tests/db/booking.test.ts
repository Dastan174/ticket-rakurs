// Проверяет функции брони на настоящем Postgres (PGlite в памяти) с теми же миграциями, что идут в Supabase.
// Конкурентность (две транзакции одновременно) здесь не проверить — это задача нагрузочного теста k6.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "../../supabase/migrations");
const U1 = "00000000-0000-0000-0000-000000000001";
const U2 = "00000000-0000-0000-0000-000000000002";

// Минимальная заглушка того, что Supabase создаёт сам.
const SUPABASE_STUB = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

let db: PGlite;
let eventId: string;
let seatIds: number[];

const as = (user: string | null) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? ""]);
const hold = async (ids: number[]) =>
  (await db.query<{ id: string }>(`select public.hold_seats($1, $2) as id`, [eventId, ids])).rows[0].id;
const statusOf = async (id: number) =>
  (await db.query<{ status: string }>(`select status from event_seats where seat_id = $1`, [id])).rows[0].status;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).sort()) await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));

  await db.exec(`insert into auth.users values ('${U1}'), ('${U2}')`);
  const { rows } = await db.query<{ id: string }>(`
    with v as (insert into venues (slug, name) values ('arena', 'Арена') returning id),
    l as (insert into venue_layouts (venue_id, version, params) select id, 1, '{}' from v returning id),
    s as (insert into seats (layout_id, sector, row, number, x, y, z)
          select l.id, 1, 1, n, 0, 0, 0 from l, generate_series(1, 10) n returning id),
    e as (insert into events (slug, layout_id, title, category, starts_at, published, max_per_user)
          select 'show', id, 'Шоу', 'concert', now() + interval '30 days', true, 6 from l returning id),
    z as (insert into price_zones (event_id, name, price) select id, 'Стандарт', 2500 from e returning id, event_id)
    insert into event_seats (event_id, seat_id, zone_id) select z.event_id, s.id, z.id from z, s
    returning event_id as id`);
  eventId = rows[0].id;
  seatIds = (await db.query<{ id: number }>(`select id from seats order by id`)).rows.map((r) => Number(r.id));
});

describe("hold_seats", () => {
  it("бронирует места и считает сумму", async () => {
    await as(U1);
    const order = await hold([seatIds[0], seatIds[1]]);
    expect(await statusOf(seatIds[0])).toBe("held");
    const { rows } = await db.query<{ total: number }>(`select total from orders where id = $1`, [order]);
    expect(rows[0].total).toBe(5000);
  });

  it("не даёт занять уже занятое место и откатывает весь заказ", async () => {
    await as(U1);
    await hold([seatIds[0]]);
    await as(U2);
    await expect(hold([seatIds[1], seatIds[0]])).rejects.toThrow(/seats_taken/);
    expect(await statusOf(seatIds[1])).toBe("free");
    const { rows } = await db.query(`select 1 from orders where user_id = $1`, [U2]);
    expect(rows).toHaveLength(0);
  });

  it("забирает место с просроченной бронью", async () => {
    await as(U1);
    await hold([seatIds[0]]);
    await db.exec(`update event_seats set hold_until = now() - interval '1 second'`);
    await as(U2);
    await expect(hold([seatIds[0]])).resolves.toBeTruthy();
  });

  it("держит лимит билетов на человека", async () => {
    await as(U1);
    await hold(seatIds.slice(0, 4));
    await expect(hold(seatIds.slice(4, 7))).rejects.toThrow(/limit_exceeded/);
  });

  it("требует входа", async () => {
    await as(null);
    await expect(hold([seatIds[0]])).rejects.toThrow(/not_authenticated/);
  });
});

describe("confirm_payment", () => {
  it("продаёт места, выпускает билеты и идемпотентна", async () => {
    await as(U1);
    const order = await hold([seatIds[0], seatIds[1]]);
    const pay = async () =>
      (await db.query<{ s: string }>(`select public.confirm_payment($1) as s`, [order])).rows[0].s;
    expect(await pay()).toBe("paid");
    expect(await pay()).toBe("paid");
    expect(await statusOf(seatIds[0])).toBe("sold");
    const { rows } = await db.query(`select 1 from tickets where order_id = $1`, [order]);
    expect(rows).toHaveLength(2);
  });

  it("если места ушли другому, помечает заказ на возврат денег", async () => {
    await as(U1);
    const late = await hold([seatIds[0]]);
    await db.exec(`update event_seats set hold_until = now() - interval '1 second'`);
    await as(U2);
    await hold([seatIds[0]]);
    const { rows } = await db.query<{ s: string }>(`select public.confirm_payment($1) as s`, [late]);
    expect(rows[0].s).toBe("refund_required");
    expect(await statusOf(seatIds[0])).toBe("held");
  });
});

describe("expire_holds", () => {
  it("освобождает просроченные брони", async () => {
    await as(U1);
    const order = await hold([seatIds[0]]);
    await db.exec(`update event_seats set hold_until = now() - interval '1 second';
                   update orders set expires_at = now() - interval '1 second'`);
    await db.query(`select public.expire_holds()`);
    expect(await statusOf(seatIds[0])).toBe("free");
    const { rows } = await db.query<{ status: string }>(`select status from orders where id = $1`, [order]);
    expect(rows[0].status).toBe("expired");
  });
});
