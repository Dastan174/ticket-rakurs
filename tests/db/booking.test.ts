// Проверяет функции брони на настоящем Postgres (PGlite в памяти) с теми же миграциями, что идут в Supabase.
// Конкурентность (две транзакции одновременно) здесь не проверить — это задача нагрузочного теста k6.
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { U1, U2, createTestDb } from "./setup";

let db: PGlite;
let eventId: string;
let seatIds: number[];
let as: (user: string | null) => Promise<unknown>;

const hold = async (ids: number[]) =>
  (await db.query<{ id: string }>(`select public.hold_seats($1, $2) as id`, [eventId, ids])).rows[0].id;
const statusOf = async (id: number) =>
  (await db.query<{ status: string }>(`select status from event_seats where seat_id = $1`, [id])).rows[0].status;

beforeEach(async () => {
  ({ db, eventId, seatIds, as } = await createTestDb());
});

describe("hold_seats", () => {
  it("бронирует места и считает сумму", async () => {
    await as(U1);
    const order = await hold([seatIds[0], seatIds[1]]);
    expect(await statusOf(seatIds[0])).toBe("held");
    const { rows } = await db.query<{ total: number }>(`select total from orders where id = $1`, [order]);
    expect(rows[0].total).toBe(10000);
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
