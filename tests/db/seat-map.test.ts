import { describe, expect, it } from "vitest";
import { U1, createTestDb } from "./setup";

interface SeatMap {
  ids: number[];
  status: string;
  zone: string;
}

describe("event_seat_map", () => {
  it("отдаёт id, статусы и зоны в порядке seat_id", async () => {
    const { db, eventId, seatIds, as } = await createTestDb();
    await as(U1);
    await db.query(`select public.hold_seats($1, $2)`, [eventId, [seatIds[1]]]);

    const { rows } = await db.query<{ m: SeatMap }>(`select public.event_seat_map($1) as m`, [eventId]);
    const m = rows[0].m;
    expect(m.ids.map(Number)).toEqual(seatIds);
    expect(m.status).toBe("0100000000");
    expect(m.zone).toBe("0000011111"); // VIP дороже — индекс 0
  });

  it("просроченная бронь показывается свободной", async () => {
    const { db, eventId, seatIds, as } = await createTestDb();
    await as(U1);
    await db.query(`select public.hold_seats($1, $2)`, [eventId, [seatIds[0]]]);
    await db.exec(`update event_seats set hold_until = now() - interval '1 second'`);
    const { rows } = await db.query<{ m: SeatMap }>(`select public.event_seat_map($1) as m`, [eventId]);
    expect(rows[0].m.status[0]).toBe("0");
  });

  it("для неопубликованного события пусто", async () => {
    const { db, eventId } = await createTestDb();
    await db.exec(`update events set published = false`);
    const { rows } = await db.query<{ m: SeatMap }>(`select public.event_seat_map($1) as m`, [eventId]);
    expect(rows[0].m).toEqual({ ids: [], status: "", zone: "" });
  });
});
