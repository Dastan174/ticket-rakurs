import { describe, expect, it } from "vitest";
import { applySeatMap } from "@/lib/venue/seat-map";
import type { Seat } from "@/lib/venue/types";

const seat = (id: number): Seat => ({ id, sector: 1, row: 1, number: id + 1, x: 0, y: 0, z: 0, zone: 2 });

describe("applySeatMap", () => {
  it("накладывает зоны, статусы и id из БД по индексу", () => {
    const r = applySeatMap([seat(0), seat(1), seat(2)], { ids: [101, 102, 103], status: "010", zone: "012" });
    expect(r.seats.map((s) => s.zone)).toEqual([0, 1, 2]);
    expect([...r.unavailable]).toEqual([0, 1, 0]);
    expect(r.dbIds).toEqual([101, 102, 103]);
  });

  it("падает, если число мест не совпадает", () => {
    expect(() => applySeatMap([seat(0)], { ids: [1, 2], status: "00", zone: "00" })).toThrow(/не совпадает/);
  });
});
