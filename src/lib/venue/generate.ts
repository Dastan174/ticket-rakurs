import type { Seat, VenueLayout, ZoneRule } from "./types";

const AISLE_GAP = 0.035; // радианы между секторами — проход

function zoneOf(rule: ZoneRule, angle: number, row: number, x: number, z: number): number {
  if (rule.by === "distance") {
    const d = Math.hypot(x - rule.origin[0], z - rule.origin[1]);
    const i = rule.thresholds.findIndex((t) => d < t);
    return i === -1 ? rule.thresholds.length : i;
  }
  const s = Math.abs(Math.sin(angle));
  return s > rule.strong && row < rule.strongRows ? 0 : s > rule.mid ? 1 : 2;
}

/** Места в стабильном порядке (сектор → ряд → место). Порядок = id в демо и порядок вставки в БД. */
export function generateSeats(layout: VenueLayout): Seat[] {
  const b = layout.bowl;
  const seats: Seat[] = [];
  const span = (b.a1 - b.a0) / b.sectors;
  for (let s = 0; s < b.sectors; s++) {
    const sa0 = b.a0 + s * span + AISLE_GAP / 2;
    const sa1 = sa0 + span - AISLE_GAP;
    for (let r = 0; r < b.rows; r++) {
      const d = r * b.depth + b.depth * 0.55;
      const radius = (b.rx + b.rz) / 2 + d;
      const n = Math.floor(((sa1 - sa0) * radius) / b.spacing);
      for (let i = 0; i < n; i++) {
        const a = sa0 + ((i + 0.5) / n) * (sa1 - sa0);
        const x = Math.cos(a) * (b.rx + d);
        const z = Math.sin(a) * (b.rz + d);
        seats.push({
          id: seats.length,
          sector: s + 1,
          row: r + 1,
          number: i + 1,
          x,
          y: b.base + r * b.rise,
          z,
          zone: zoneOf(layout.zones, a, r, x, z),
        });
      }
    }
  }
  return seats;
}

/** Высота пола в точке: 0 в партере, ступень ряда на трибуне, null — стена (туда не пройти). */
export function groundHeight(layout: VenueLayout, x: number, z: number): number | null {
  const b = layout.bowl;
  if ((x * x) / (b.rx * b.rx) + (z * z) / (b.rz * b.rz) < 1) {
    const st = layout.stage;
    return st && x > st.x0 && x < st.x1 && Math.abs(z) < st.halfZ ? st.height : 0;
  }
  const a = Math.atan2(z / b.rz, x / b.rx);
  if (a < b.a0 || a > b.a1) return null;
  const maxD = b.rows * b.depth - 0.3;
  const f = (d: number) => (x * x) / (b.rx + d) ** 2 + (z * z) / (b.rz + d) ** 2 - 1;
  if (f(maxD) > 0) return null;
  let lo = 0;
  let hi = maxD;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) lo = m;
    else hi = m;
  }
  return b.base + Math.floor(lo / b.depth) * b.rise;
}
