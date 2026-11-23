import { Matrix4, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { nearestSeat } from "@/lib/venue/pick";

// Камера в начале координат смотрит вдоль −Z
const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
camera.updateMatrixWorld();
const vp = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements;
const opts = { halfW: 200, halfH: 200 };

describe("nearestSeat", () => {
  it("под пальцем выбирает ближнее к камере из перекрывающихся кресел", () => {
    const pts = new Float32Array([0, 0, -20, 0, 0, -10, 5, 0, -10]);
    expect(nearestSeat(pts, vp, 0, 0, { ...opts, radiusM: 0.3 })).toBe(1);
  });

  it("мимо кресел — null", () => {
    const pts = new Float32Array([5, 5, -10]);
    expect(nearestSeat(pts, vp, 0, 0, { ...opts, radiusM: 0.3, minPx: 4 })).toBeNull();
  });

  it("кресла за спиной не выбираются", () => {
    const pts = new Float32Array([0, 0, 10]);
    expect(nearestSeat(pts, vp, 0, 0, { ...opts, maxPx: 1000 })).toBeNull();
  });

  it("«что в кадре» — ближайшее к центру экрана в пределах maxPx", () => {
    const pts = new Float32Array([3, 0, -10, 1, 0, -10]);
    expect(nearestSeat(pts, vp, 0, 0, { ...opts, maxPx: 150 })).toBe(1);
    expect(nearestSeat(pts, vp, 0, 0, { ...opts, maxPx: 5 })).toBeNull();
  });
});
