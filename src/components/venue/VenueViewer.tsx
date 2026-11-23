"use client";

// 3D-зал: обзор (OrbitControls) и режим «сесть на место» с ходьбой по ступеням.
// Three.js императивно, без react-three-fiber: код перенесён из прототипа docs/product/prototype.html (см. ADR 0002).
// Сцена строится один раз на layout; смена статусов и выбора только перекрашивает инстансы.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ArrowLeft } from "@/components/icons";
import { groundHeight } from "@/lib/venue/generate";
import { nearestSeat } from "@/lib/venue/pick";
import type { Seat, VenueLayout } from "@/lib/venue/types";

export interface VenueViewerProps {
  layout: VenueLayout;
  seats: Seat[];
  /** 1 — место недоступно (продано или в чужой брони) */
  unavailable: Uint8Array;
  zoneColors: string[];
  selected: ReadonlySet<number>;
  /** Текст на экране сцены */
  screenTitle?: string;
  /** id места, с которого смотрим, или null — обзор */
  viewSeat: number | null;
  onSeatClick: (id: number) => void;
  onSeatOpen: (id: number) => void;
  onHover?: (id: number | null, x: number, y: number) => void;
  /** Кресло в центре кадра на общем плане — для строки «что в кадре» */
  onCenter?: (id: number | null) => void;
  onExitView: () => void;
}

// Цвета мира «Смальта» (DESIGN.md): занятое — серый бетон, ваше — золотая смальта.
const C_SOLD = new THREE.Color("#6b6e72");
const C_SEL = new THREE.Color("#f0be2c");
const C_HOVER = new THREE.Color("#ffffff");
const KEYMAP: Record<string, string> = {
  KeyW: "f", ArrowUp: "f", KeyS: "b", ArrowDown: "b", KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r",
  ShiftLeft: "shift", ShiftRight: "shift",
};

type Mode = "overview" | "fly" | "view";
const FLY_SECONDS = 1.1;

interface Engine {
  paint: () => void;
  enterSeat: (id: number) => void;
  exitSeat: () => void;
  keys: Set<string>;
}

export function VenueViewer(props: VenueViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const prevViewSeat = useRef<number | null>(null);
  // Последние пропсы для обработчиков внутри three.js без пересоздания сцены
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const { layout, seats } = props;
    const b = layout.bowl;

    // Слабое устройство: без сглаживания, плотность пикселей 1, чаша проще. Покупка не должна ждать графику.
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowEnd, powerPreference: "high-performance" });
    renderer.setPixelRatio(lowEnd ? 1 : Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(layout.colors.sky);
    scene.fog = new THREE.Fog(layout.colors.sky, b.rx * 2.5, b.rx * 9);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1500);
    camera.rotation.order = "YXZ";
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.maxPolarAngle = 1.45;
    controls.minDistance = 8;
    controls.maxDistance = 260;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, layout.night ? 0.7 : 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, layout.night ? 0.6 : 1.6);
    sun.position.set(30, 60, 20);
    scene.add(sun);

    // Чаша трибун: ступени + передняя и задняя стены
    const pos: number[] = [];
    const P = (a: number, d: number, y: number) => [Math.cos(a) * (b.rx + d), y, Math.sin(a) * (b.rz + d)];
    const quad = (p1: number[], p2: number[], p3: number[], p4: number[]) => pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
    const segs = Math.ceil((b.a1 - b.a0) * (lowEnd ? 20 : 48));
    const top = b.base + (b.rows - 1) * b.rise;
    const dMax = b.rows * b.depth;
    for (let k = 0; k < segs; k++) {
      const A = b.a0 + ((b.a1 - b.a0) * k) / segs;
      const B = b.a0 + ((b.a1 - b.a0) * (k + 1)) / segs;
      quad(P(A, 0, 0), P(B, 0, 0), P(B, 0, b.base), P(A, 0, b.base));
      for (let r = 0; r < b.rows; r++) {
        const d0 = r * b.depth, d1 = d0 + b.depth, y = b.base + r * b.rise;
        quad(P(A, d0, y), P(A, d1, y), P(B, d1, y), P(B, d0, y));
        if (r < b.rows - 1) quad(P(A, d1, y), P(B, d1, y), P(B, d1, y + b.rise), P(A, d1, y + b.rise));
      }
      quad(P(A, dMax, top), P(B, dMax, top), P(B, dMax, top + 4), P(A, dMax, top + 4));
    }
    const bowlGeo = new THREE.BufferGeometry();
    bowlGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    bowlGeo.computeVertexNormals();
    scene.add(new THREE.Mesh(bowlGeo, new THREE.MeshLambertMaterial({ color: layout.colors.bowl, side: THREE.DoubleSide })));

    // Кресла — один InstancedMesh
    const seatGeo = mergeGeometries([
      new THREE.BoxGeometry(0.46, 0.1, 0.42).translate(0, 0.42, 0),
      new THREE.BoxGeometry(0.46, 0.42, 0.07).translate(0, 0.62, -0.19),
    ]);
    const mesh = new THREE.InstancedMesh(seatGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), seats.length);
    const dummy = new THREE.Object3D();
    seats.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.lookAt(0, s.y, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, C_SOLD);
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
    // Центры кресел для выбора по экрану (nearestSeat) — вместо raycast по 10 000 инстансов
    const pts = new Float32Array(seats.length * 3);
    seats.forEach((s, i) => {
      pts[i * 3] = s.x;
      pts[i * 3 + 1] = s.y + 0.5;
      pts[i * 3 + 2] = s.z;
    });

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2).scale(b.rx, 1, b.rz),
      new THREE.MeshLambertMaterial({ color: layout.colors.floor }),
    );
    scene.add(floor);
    if (layout.kind === "football") {
      const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 68).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: pitchTexture() }));
      pitch.position.y = 0.02;
      scene.add(pitch);
    }
    for (const box of layout.boxes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...box.size), new THREE.MeshLambertMaterial({ color: box.color }));
      m.position.set(...box.pos);
      scene.add(m);
    }
    if (layout.screen) {
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(...layout.screen.size),
        new THREE.MeshBasicMaterial({ map: screenTexture(props.screenTitle ?? "") }),
      );
      screen.position.set(...layout.screen.pos);
      screen.rotation.y = Math.PI / 2;
      scene.add(screen);
    }
    if (layout.night) {
      for (const [c, z] of [[0xffb347, -6], [0x7fa2ff, 6]] as const) {
        const l = new THREE.PointLight(c, 300, 40);
        l.position.set(layout.focus[0] + 3, 9, z);
        scene.add(l);
      }
    }

    // ---------- состояние ----------
    let mode: Mode = "overview";
    let hoverIdx: number | null = null;
    let fly: { t: number; p0: THREE.Vector3; p1: THREE.Vector3; l0: THREE.Vector3; l1: THREE.Vector3; done: () => void } | null = null;
    let yaw = 0, pitch = 0, groundY = 0, standing = false;
    const keys = new Set<string>();
    const ndc = new THREE.Vector2();
    const vp = new THREE.Matrix4();
    let viewW = 1, viewH = 1;
    // Рендер по требованию: кадр рисуется только когда что-то изменилось
    let dirty = true;
    let lastMove = 0;
    let centerDone = false;
    let needPick = false;
    // Вспышка выбора: только что выбранное кресло на мгновение светлеет и садится в золото
    const flashes = new Map<number, number>();
    let prevSelected = new Set<number>(live.current.selected);
    const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let centerId: number | null = null;
    let mouse = { x: 0, y: 0 };
    let down: { x: number; y: number; sx: number; sy: number } | null = null;

    controls.addEventListener("change", () => {
      dirty = true;
      lastMove = performance.now();
      centerDone = false;
    });

    const setOverview = () => {
      mode = "overview";
      centerDone = false;
      controls.enabled = true;
      camera.position.set(...layout.overview.pos);
      controls.target.set(...layout.overview.target);
      controls.update();
    };
    setOverview();

    const paint = () => {
      const { unavailable, selected, zoneColors } = live.current;
      const zoneCols = zoneColors.map((c) => new THREE.Color(c)); // цвета зон один раз, а не разбор строки на каждое кресло
      seats.forEach((s, i) => {
        const c = i === hoverIdx && mode === "overview" ? C_HOVER : selected.has(i) ? C_SEL : unavailable[i] ? C_SOLD : zoneCols[s.zone];
        mesh.setColorAt(i, c);
      });
      if (!reducedMotion()) for (const id of selected) if (!prevSelected.has(id)) flashes.set(id, performance.now());
      prevSelected = new Set(selected);
      mesh.instanceColor!.needsUpdate = true;
      dirty = true;
    };
    paint();

    const lookPoint = () => new THREE.Vector3(0, 0, -10).applyQuaternion(camera.quaternion).add(camera.position);
    const flyTo = (p1: THREE.Vector3, l1: THREE.Vector3, done: () => void) => {
      // Большое движение камеры может укачивать: при reduced motion — сразу конечный кадр.
      const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      fly = { t: instant ? 1 : 0, p0: camera.position.clone(), l0: mode === "overview" ? controls.target.clone() : lookPoint(), p1, l1, done };
    };
    const enterSeat = (id: number) => {
      const s = seats[id];
      if (!s) return;
      controls.enabled = false;
      mode = "fly";
      hoverIdx = null;
      paint();
      standing = false;
      groundY = s.y;
      flyTo(new THREE.Vector3(s.x, s.y + 1.2, s.z), new THREE.Vector3(...layout.focus), () => {
        const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
        yaw = e.y;
        pitch = e.x;
        mode = "view";
      });
    };
    const exitSeat = () => {
      mode = "fly";
      keys.clear();
      flyTo(new THREE.Vector3(...layout.overview.pos), new THREE.Vector3(...layout.overview.target), setOverview);
    };
    engineRef.current = { paint, enterSeat, exitSeat, keys };

    const pickAt = (x: number, y: number, maxPx?: number) => {
      camera.updateMatrixWorld();
      vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      return nearestSeat(pts, vp.elements, x, y, { halfW: viewW / 2, halfH: viewH / 2, radiusM: 0.32, minPx: 7, maxPx });
    };
    const pick = () => pickAt(ndc.x, ndc.y);
    const setNdc = (e: PointerEvent | MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      ndc.set((mouse.x / r.width) * 2 - 1, -(mouse.y / r.height) * 2 + 1);
    };

    const walk = (dt: number) => {
      let f = 0, s = 0;
      if (keys.has("f")) f++;
      if (keys.has("b")) f--;
      if (keys.has("r")) s++;
      if (keys.has("l")) s--;
      if (f || s) {
        standing = true;
        const sp = ((keys.has("shift") ? 9 : 3.2) * dt) / Math.hypot(f, s);
        const nx = camera.position.x + (-Math.sin(yaw) * f + Math.cos(yaw) * s) * sp;
        const nz = camera.position.z + (-Math.cos(yaw) * f - Math.sin(yaw) * s) * sp;
        const g = groundHeight(layout, nx, nz);
        if (g !== null && g - groundY < 1.7) {
          camera.position.x = nx;
          camera.position.z = nz;
          groundY = g;
        }
      }
      const ty = groundY + (standing ? 1.65 : 1.2);
      const dy = ty - camera.position.y;
      camera.position.y += dy * Math.min(1, dt * 10);
      camera.rotation.set(pitch, yaw, 0);
      if (f || s || Math.abs(dy) > 0.002) dirty = true;
    };

    // Экспоненциальное замедление: камера срывается быстро и мягко садится на место.
    const ease = (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (fly) {
        dirty = true;
        fly.t += dt / FLY_SECONDS;
        const k = ease(Math.min(1, fly.t));
        camera.position.lerpVectors(fly.p0, fly.p1, k);
        camera.lookAt(new THREE.Vector3().lerpVectors(fly.l0, fly.l1, k));
        if (fly.t >= 1) {
          const f = fly;
          fly = null;
          f.done();
        }
      } else if (mode === "overview") {
        controls.update();
        // «Что в кадре» — один раз, когда камера остановилась
        if (!centerDone && t - lastMove > 250) {
          centerDone = true;
          const hit = pickAt(0, 0, Math.min(viewW, viewH) * 0.3);
          if (hit !== centerId) {
            centerId = hit;
            live.current.onCenter?.(hit);
          }
        }
        if (needPick) {
          needPick = false;
          const i = pick();
          if (i !== hoverIdx) {
            hoverIdx = i;
            paint();
          }
          live.current.onHover?.(i, mouse.x, mouse.y);
          canvas.style.cursor = i === null ? "" : live.current.unavailable[i] ? "not-allowed" : "pointer";
        }
      } else walk(dt);
      if (flashes.size) {
        const flashColor = new THREE.Color();
        for (const [id, start] of flashes) {
          const k = (t - start) / 320;
          if (k >= 1) {
            flashes.delete(id);
            mesh.setColorAt(id, C_SEL);
          } else mesh.setColorAt(id, flashColor.copy(C_HOVER).lerp(C_SEL, ease(Math.max(0, k))));
        }
        mesh.instanceColor!.needsUpdate = true;
        dirty = true;
      }
      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      viewW = w;
      viewH = h;
      dirty = true;
    });
    ro.observe(wrap);

    const onMove = (e: PointerEvent) => {
      setNdc(e);
      if (mode === "overview" && e.pointerType === "mouse") needPick = true;
      if (mode === "view" && down) {
        yaw -= (e.clientX - down.x) * 0.0035;
        pitch = Math.max(-1.3, Math.min(1.3, pitch - (e.clientY - down.y) * 0.0035));
        dirty = true;
        down = { ...down, x: e.clientX, y: e.clientY };
      }
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (mode !== "overview" || !d || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) return;
      setNdc(e);
      const i = pick();
      if (i !== null && !live.current.unavailable[i]) live.current.onSeatClick(i);
    };
    const onDbl = (e: MouseEvent) => {
      if (mode !== "overview") return;
      setNdc(e);
      const i = pick();
      if (i !== null && !live.current.unavailable[i]) live.current.onSeatOpen(i);
    };
    const onLeave = () => {
      down = null;
      live.current.onHover?.(null, 0, 0);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== "view") return;
      if (e.code === "Escape") return live.current.onExitView();
      const k = KEYMAP[e.code];
      if (k) {
        keys.add(k);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = KEYMAP[e.code];
      if (k) keys.delete(k);
    };
    const onBlur = () => keys.clear();
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.MeshBasicMaterial | undefined;
        mat?.map?.dispose();
        mat?.dispose?.();
      });
      renderer.dispose();
      engineRef.current = null;
    };
    // Сцена пересоздаётся только при смене зала; остальное читается из live.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.layout, props.seats]);

  useEffect(() => {
    engineRef.current?.paint();
  }, [props.unavailable, props.selected, props.zoneColors]);

  useEffect(() => {
    const e = engineRef.current;
    const prev = prevViewSeat.current;
    prevViewSeat.current = props.viewSeat;
    // При монтировании камера уже на общем плане — перелёт «в обзор» был бы лишней секундой рендера
    if (!e || prev === props.viewSeat) return;
    if (props.viewSeat === null) e.exitSeat();
    else e.enterSeat(props.viewSeat);
  }, [props.viewSeat]);

  const padKey = (k: string, on: boolean) => {
    const keys = engineRef.current?.keys;
    if (!keys) return;
    if (on) keys.add(k);
    else keys.delete(k);
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-night">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" aria-label="3D-схема зала" />
      {props.viewSeat !== null && (
        // На телефоне нет клавиатуры — стрелки для ходьбы
        <div className="absolute bottom-14 right-4 hidden grid-cols-3 gap-1.5 pointer-coarse:grid">
          {([["f", "вперёд", "col-start-2", 90], ["l", "влево", "col-start-1 row-start-2", 0], ["b", "назад", "col-start-2 row-start-2", 270], ["r", "вправо", "col-start-3 row-start-2", 180]] as const).map(([k, label, cls, rot]) => (
            <button
              key={k}
              type="button"
              aria-label={`Идти ${label}`}
              className={`${cls} on-night grid size-12 touch-none select-none place-items-center`}
              onPointerDown={() => padKey(k, true)}
              onPointerUp={() => padKey(k, false)}
              onPointerLeave={() => padKey(k, false)}
              onPointerCancel={() => padKey(k, false)}
            >
              <ArrowLeft style={{ transform: `rotate(${rot}deg)` }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function screenTexture(title: string) {
  return canvasTexture(1024, 512, (c) => {
    // Графитовый экран с полосой смальты — без фиолетовых градиентов (DESIGN.md)
    c.fillStyle = "#1e2226";
    c.fillRect(0, 0, 1024, 512);
    const smalt = ["#2550a8", "#1a8a82", "#6f7f33"];
    for (let i = 0; i < 32; i++) {
      c.fillStyle = smalt[(i * 7) % 3];
      c.fillRect(i * 32 + 2, 430, 28, 28);
    }
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-unbounded").trim() || "system-ui";
    c.fillStyle = "#d6d3cc";
    c.font = `700 76px ${family}`;
    c.textAlign = "center";
    c.fillText(title, 512, 250, 940);
  });
}

function pitchTexture() {
  return canvasTexture(1050, 680, (c) => {
    for (let i = 0; i < 14; i++) {
      c.fillStyle = i % 2 ? "#3c8c45" : "#348040";
      c.fillRect(i * 75, 0, 75, 680);
    }
    c.strokeStyle = "#fff";
    c.lineWidth = 4;
    c.strokeRect(5, 5, 1040, 670);
    c.beginPath();
    c.moveTo(525, 5);
    c.lineTo(525, 675);
    c.stroke();
    c.beginPath();
    c.arc(525, 340, 91.5, 0, Math.PI * 2);
    c.stroke();
    c.strokeRect(5, 138, 165, 403);
    c.strokeRect(880, 138, 165, 403);
    c.strokeRect(5, 248, 55, 184);
    c.strokeRect(990, 248, 55, 184);
  });
}
