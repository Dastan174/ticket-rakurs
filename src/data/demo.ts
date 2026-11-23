// Демо-данные до подключения Supabase. Тот же формат, что в venue_layouts.params и events.
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
      { size: [8, 1.5, 18], pos: [-17, 0.75, 0], color: "#1c1f26" },
      { size: [1.6, 7, 1.6], pos: [-14.5, 3.5, -10.5], color: "#0b0c10" },
      { size: [1.6, 7, 1.6], pos: [-14.5, 3.5, 10.5], color: "#0b0c10" },
      { size: [0.3, 10, 0.3], pos: [-13.5, 5, -11], color: "#555b66" },
      { size: [0.3, 10, 0.3], pos: [-13.5, 5, 11], color: "#555b66" },
      { size: [0.4, 0.4, 22], pos: [-13.5, 10, 0], color: "#555b66" },
    ],
    zones: { by: "distance", origin: [-17, 0], thresholds: [18, 32] },
    colors: { sky: "#07080d", bowl: "#2a2f3a", floor: "#15181f" },
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
  category: "Концерт" | "Спорт" | "Театр" | "Юмор" | "Детям";
  title: string;
  date: string;
  layout: keyof typeof LAYOUTS;
  /** Цена по зонам, сом: [VIP, стандарт, эконом] */
  prices: number[];
  seed: number;
}

export const ZONE_NAMES = ["VIP", "Стандарт", "Эконом"];
export const ZONE_COLORS = ["#f5b942", "#5b8cff", "#2bc4b6"];

export const EVENTS: DemoEvent[] = [
  { slug: "synthwave-night", category: "Концерт", title: "Ночь синтвейва", date: "12 декабря, 19:00", layout: "arena", prices: [9000, 5500, 2500], seed: 11 },
  { slug: "jazz-med", category: "Концерт", title: "Джаз-оркестр «Медь»", date: "20 декабря, 20:00", layout: "arena", prices: [6000, 3500, 1800], seed: 23 },
  { slug: "cup-final", category: "Спорт", title: "Финал кубка: Сокол — Титан", date: "28 декабря, 17:00", layout: "stadium", prices: [4500, 2500, 1200], seed: 37 },
];

/** Детерминированный «продано» для демо, одинаковый на сервере и клиенте */
export function demoSold(seed: number, count: number, share = 0.32): Uint8Array {
  const out = new Uint8Array(count);
  let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296 < share ? 1 : 0;
  }
  return out;
}

export const formatSom = (n: number) => `${n.toLocaleString("ru-RU")} сом`;
