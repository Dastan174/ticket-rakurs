// Поиск кресла по экранной точке без raycast: проецируем центры кресел и берём подходящее.
// Raycast по InstancedMesh на 10 000 кресел проверяет каждый инстанс и на телефоне занимает десятки мс;
// проекция точек — один проход по Float32Array.

export interface PickOptions {
  /** Ширина/высота области в пикселях пополам */
  halfW: number;
  halfH: number;
  /** Режим «под пальцем»: радиус кресла в метрах и минимальный радиус попадания в пикселях */
  radiusM?: number;
  minPx?: number;
  /** Режим «что в кадре»: ближайшее к точке кресло в пределах maxPx, без учёта глубины */
  maxPx?: number;
}

/**
 * points — xyz центров кресел подряд; m — матрица view-projection (16 чисел, column-major, как Matrix4.elements).
 * Возвращает индекс кресла или null.
 */
export function nearestSeat(points: Float32Array, m: ArrayLike<number>, ndcX: number, ndcY: number, o: PickOptions): number | null {
  const focal = m[5] * o.halfH; // для перспективной матрицы m[5] = 1 / tan(fov / 2)
  let best: number | null = null;
  let bestScore = Infinity;
  for (let i = 0, n = points.length / 3; i < n; i++) {
    const x = points[i * 3], y = points[i * 3 + 1], z = points[i * 3 + 2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0.1) continue; // позади камеры
    const dx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w - ndcX) * o.halfW;
    const dy = ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w - ndcY) * o.halfH;
    const d2 = dx * dx + dy * dy;
    if (o.maxPx !== undefined) {
      if (d2 <= o.maxPx * o.maxPx && d2 < bestScore) {
        best = i;
        bestScore = d2;
      }
      continue;
    }
    const r = Math.max(((o.radiusM ?? 0.3) * focal) / w, o.minPx ?? 6);
    // Из попавших под палец выигрывает ближнее к камере кресло
    if (d2 <= r * r && w < bestScore) {
      best = i;
      bestScore = w;
    }
  }
  return best;
}
