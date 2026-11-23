import { describe, expect, it } from "vitest";
import { LAYOUTS } from "@/data/demo";
import { generateSeats, groundHeight } from "@/lib/venue/generate";

describe("generateSeats", () => {
  for (const [key, layout] of Object.entries(LAYOUTS)) {
    it(`${key}: места уникальны, id по порядку, зоны 0..2`, () => {
      const seats = generateSeats(layout);
      expect(seats.length).toBeGreaterThan(1000);
      expect(new Set(seats.map((s) => `${s.sector}-${s.row}-${s.number}`)).size).toBe(seats.length);
      seats.forEach((s, i) => expect(s.id).toBe(i));
      expect(seats.every((s) => s.zone >= 0 && s.zone <= 2)).toBe(true);
    });
  }

  it("стабилен: одни и те же параметры дают те же места", () => {
    expect(generateSeats(LAYOUTS.arena)).toEqual(generateSeats(LAYOUTS.arena));
  });
});

describe("groundHeight", () => {
  const st = LAYOUTS.stadium;
  it("центр поля — 0", () => expect(groundHeight(st, 0, 0)).toBe(0));
  it("третий ряд — base + 2 ступени", () => expect(groundHeight(st, 0, 39 + 0.85 * 2.5)).toBeCloseTo(1.5 + 2 * 0.45));
  it("за трибуной — стена", () => expect(groundHeight(st, 0, 200)).toBeNull());
  it("на сцене арены — высота сцены", () => expect(groundHeight(LAYOUTS.arena, -17, 0)).toBe(1.5));
  it("за сценой трибун нет — стена", () => expect(groundHeight(LAYOUTS.arena, -30, 0)).toBeNull());
});
