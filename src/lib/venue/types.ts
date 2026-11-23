// Формат площадки (JSON в venue_layouts.params). Описание полей — docs/venue-format.md.
// Из одного объекта строятся 2D, 3D и список мест: модель вручную не рисуем.

export type Vec3 = [number, number, number];

export interface VenueBowl {
  /** Полуоси эллипса поля/партера, метры */
  rx: number;
  rz: number;
  rows: number;
  /** Глубина ряда и высота ступени, метры */
  depth: number;
  rise: number;
  /** Высота первого ряда над полом */
  base: number;
  /** Дуга трибун в радианах: от a0 до a1 (−π…π — по кругу) */
  a0: number;
  a1: number;
  sectors: number;
  /** Шаг кресел в ряду, метры */
  spacing: number;
}

/** Препятствие или декорация: колонна, звуковой портал, ферма */
export interface VenueBox {
  size: Vec3;
  pos: Vec3;
  color: string;
}

export type ZoneRule =
  | { by: "distance"; origin: [number, number]; thresholds: number[] }
  | { by: "sideline"; strong: number; strongRows: number; mid: number };

export interface VenueLayout {
  name: string;
  kind: "concert" | "football";
  night: boolean;
  bowl: VenueBowl;
  /** Куда смотрит зритель, севший на место */
  focus: Vec3;
  overview: { pos: Vec3; target: Vec3 };
  /** Сцена: по ней можно ходить */
  stage?: { x0: number; x1: number; halfZ: number; height: number };
  screen?: { pos: Vec3; size: [number, number] };
  boxes: VenueBox[];
  zones: ZoneRule;
  colors: { sky: string; bowl: string; floor: string };
}

export interface Seat {
  id: number;
  sector: number;
  row: number;
  number: number;
  x: number;
  y: number;
  z: number;
  /** Индекс ценовой зоны (0 — самая дорогая) */
  zone: number;
}
