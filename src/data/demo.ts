// Демо-площадки и события. Загружаются в Supabase скриптом scripts/load-demo.mts (npm run db:load-demo).
// Только type-импорты: файл запускается напрямую через Node.
import type { EventCategory } from "@/lib/format";
import type { VenueLayout } from "@/lib/venue/types";

export const LAYOUTS: Record<string, VenueLayout> = {
  arena: {
    name: "Арена «Север»",
    kind: "concert",
    night: true,
    bowl: { rx: 22, rz: 16, rows: 14, depth: 0.85, rise: 0.42, base: 1.2, a0: -2.55, a1: 2.55, sectors: 10, spacing: 0.55 },
    focus: [-17, 3.5, 0],
    overview: { pos: [30, 28, 28], target: [-3, 2, 0] },
    stage: { x0: -21, x1: -13, halfZ: 9, height: 1.5 },
    screen: { pos: [-20.5, 6.5, 0], size: [16, 8] },
    boxes: [
      { size: [8, 1.5, 18], pos: [-17, 0.75, 0], color: "#22201d" },
      { size: [1.6, 7, 1.6], pos: [-14.5, 3.5, -10.5], color: "#0f0e0d" },
      { size: [1.6, 7, 1.6], pos: [-14.5, 3.5, 10.5], color: "#0f0e0d" },
      { size: [0.3, 10, 0.3], pos: [-13.5, 5, -11], color: "#5d5850" },
      { size: [0.3, 10, 0.3], pos: [-13.5, 5, 11], color: "#5d5850" },
      { size: [0.4, 0.4, 22], pos: [-13.5, 10, 0], color: "#5d5850" },
    ],
    zones: { by: "distance", origin: [-17, 0], thresholds: [18, 32] },
    colors: { sky: "#131210", bowl: "#2d2a26", floor: "#1b1916" },
  },
  stadium: {
    name: "Стадион «Центральный»",
    kind: "football",
    night: false,
    bowl: { rx: 57, rz: 39, rows: 20, depth: 0.85, rise: 0.45, base: 1.5, a0: -Math.PI, a1: Math.PI, sectors: 16, spacing: 0.6 },
    focus: [0, 0, 0],
    overview: { pos: [70, 62, 78], target: [0, 0, 0] },
    boxes: [
      ...[-52.5, 52.5].flatMap((x) => [
        { size: [0.12, 2.44, 0.12] as [number, number, number], pos: [x, 1.22, -3.66] as [number, number, number], color: "#ffffff" },
        { size: [0.12, 2.44, 0.12] as [number, number, number], pos: [x, 1.22, 3.66] as [number, number, number], color: "#ffffff" },
        { size: [0.12, 0.12, 7.32] as [number, number, number], pos: [x, 2.44, 0] as [number, number, number], color: "#ffffff" },
      ]),
    ],
    zones: { by: "sideline", strong: 0.8, strongRows: 12, mid: 0.5 },
    colors: { sky: "#9fc7ee", bowl: "#9aa1ad", floor: "#2f7a3a" },
  },
};

export interface DemoEvent {
  slug: string;
  category: EventCategory;
  title: string;
  /** ISO с часовым поясом Бишкека */
  startsAt: string;
  layout: keyof typeof LAYOUTS;
  /** Цена по зонам, сом: [VIP, стандарт, эконом] */
  prices: number[];
}

export const ZONE_NAMES = ["VIP", "Стандарт", "Эконом"];
// Смальта: кобальт, бирюза, олива (DESIGN.md). Золото не использовать — оно для мест покупателя.
export const ZONE_COLORS = ["#2550a8", "#1a8a82", "#6f7f33"];

export const EVENTS: DemoEvent[] = [
  { slug: "synthwave-night", category: "concert", title: "Ночь синтвейва", startsAt: "2026-12-12T19:00:00+06:00", layout: "arena", prices: [9000, 5500, 2500] },
  { slug: "jazz-med", category: "concert", title: "Джаз-оркестр «Медь»", startsAt: "2026-12-20T20:00:00+06:00", layout: "arena", prices: [6000, 3500, 1800] },
  { slug: "cup-final", category: "sport", title: "Финал кубка: Сокол — Титан", startsAt: "2026-12-28T17:00:00+06:00", layout: "stadium", prices: [4500, 2500, 1200] },
];
