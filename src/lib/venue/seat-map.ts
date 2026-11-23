import type { Seat } from "./types";

/** Ответ rpc('event_seat_map'): по одному символу на место в порядке seat_id */
export interface SeatMapRow {
  ids: number[];
  status: string;
  zone: string;
}

/**
 * Накладывает статусы и зоны из БД на места, сгенерированные из params площадки.
 * Порядок совпадает, потому что места вставлялись в порядке generateSeats.
 */
export function applySeatMap(seats: Seat[], map: SeatMapRow) {
  if (map.ids.length !== seats.length || map.status.length !== seats.length || map.zone.length !== seats.length) {
    throw new Error(`Карта мест не совпадает с площадкой: в БД ${map.ids.length}, на схеме ${seats.length}`);
  }
  return {
    seats: seats.map((s, i) => ({ ...s, zone: map.zone.charCodeAt(i) - 48 })),
    unavailable: Uint8Array.from(map.status, (c) => (c === "0" ? 0 : 1)),
    /** id места в БД по индексу — для hold_seats и Realtime */
    dbIds: map.ids.map(Number),
  };
}
