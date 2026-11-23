"use client";

// Экран выбора мест: 3D-зал, панель с местом и корзиной.
// Сейчас на демо-данных; бронь через rpc('hold_seats') подключается на этапе 1 (docs/booking.md).

import Link from "next/link";
import { useMemo, useState } from "react";
import { VenueViewer } from "@/components/venue/VenueViewer";
import { EVENTS, LAYOUTS, ZONE_COLORS, ZONE_NAMES, demoSold, formatSom } from "@/data/demo";
import { generateSeats } from "@/lib/venue/generate";

export function EventBooking({ slug }: { slug: string }) {
  const event = EVENTS.find((e) => e.slug === slug)!;
  const layout = LAYOUTS[event.layout];
  const seats = useMemo(() => generateSeats(layout), [layout]);
  const unavailable = useMemo(() => demoSold(event.seed, seats.length), [event.seed, seats.length]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [lastId, setLastId] = useState<number | null>(null);
  const [viewSeat, setViewSeat] = useState<number | null>(null);
  const [tip, setTip] = useState<{ id: number; x: number; y: number } | null>(null);

  const seatName = (id: number) => {
    const s = seats[id];
    return `Сектор ${s.sector} · Ряд ${s.row} · Место ${s.number}`;
  };
  const price = (id: number) => event.prices[seats[id].zone];
  const toggle = (id: number, force?: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const on = force ?? !next.has(id);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setLastId(id);
  };
  const total = [...selected].reduce((sum, id) => sum + price(id), 0);

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[62vh_auto] md:h-[calc(100dvh-3.5rem)] md:grid-cols-[1fr_340px] md:grid-rows-1">
      <div className="relative min-h-0">
        <VenueViewer
          layout={layout}
          seats={seats}
          unavailable={unavailable}
          zoneColors={ZONE_COLORS}
          selected={selected}
          screenTitle={event.title}
          viewSeat={viewSeat}
          onSeatClick={(id) => toggle(id)}
          onSeatOpen={(id) => {
            toggle(id, true);
            setViewSeat(id);
          }}
          onHover={(id, x, y) => setTip(id === null ? null : { id, x, y })}
          onExitView={() => setViewSeat(null)}
        />
        {tip && viewSeat === null && (
          <div
            className="pointer-events-none absolute whitespace-nowrap rounded-lg border border-white/15 bg-black/80 px-2.5 py-1.5 text-[13px]"
            style={{ left: tip.x + 12, top: tip.y + 12 }}
          >
            {seatName(tip.id)} — {unavailable[tip.id] ? "продано" : <b>{formatSom(price(tip.id))}</b>}
          </div>
        )}
        {viewSeat === null ? (
          <p className="absolute bottom-3.5 left-1/2 max-w-[calc(100%-24px)] -translate-x-1/2 truncate rounded-lg bg-black/70 px-3 py-1.5 text-[13px] text-zinc-300">
            Крути схему мышью · колесо — зум · клик — выбрать место · двойной клик — вид с места
          </p>
        ) : (
          <>
            <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost" onClick={() => setViewSeat(null)}>
                ← К схеме
              </button>
              <div className="flex w-full items-center gap-2.5 rounded-xl bg-black/70 px-3 py-2 text-xs sm:ml-auto sm:w-auto sm:text-sm">
                <span>
                  {seatName(viewSeat)} — <b>{formatSom(price(viewSeat))}</b>
                </span>
                <button type="button" className={selected.has(viewSeat) ? "btn-ghost" : "btn-primary"} onClick={() => toggle(viewSeat)}>
                  {selected.has(viewSeat) ? "В корзине ✓" : "В корзину"}
                </button>
              </div>
            </div>
            <p className="absolute bottom-3.5 left-1/2 max-w-[calc(100%-24px)] -translate-x-1/2 truncate rounded-lg bg-black/70 px-3 py-1.5 text-[13px] text-zinc-300">
              Тяни — осмотреться · WASD / стрелки — идти · Shift — быстрее · Esc — выход
            </p>
          </>
        )}
      </div>

      <aside className="flex flex-col gap-3 overflow-auto border-t border-line bg-panel p-[18px] md:border-l md:border-t-0">
        <Link href="/" className="text-sm text-mute hover:text-fg">
          ← Все события
        </Link>
        <div className="text-xs font-bold uppercase tracking-wider text-accent">{event.category}</div>
        <h1 className="text-[22px] font-bold leading-tight">{event.title}</h1>
        <p className="text-mute">
          {event.date} · {layout.name}
        </p>
        <ul className="flex flex-wrap gap-x-3.5 gap-y-2 text-[13px] text-mute">
          {ZONE_NAMES.map((name, i) => (
            <li key={name} className="flex items-center gap-1.5">
              <i className="inline-block size-2.5 rounded-sm" style={{ background: ZONE_COLORS[i] }} />
              {name} {formatSom(event.prices[i])}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-sm bg-[#3a3f4b]" />
            Продано
          </li>
          <li className="flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-sm bg-[#4ade80]" />
            Выбрано
          </li>
        </ul>

        <div className="rounded-xl border border-line bg-bg p-3 text-sm">
          {lastId === null ? (
            "Нажми на место на схеме. Двойной клик — сразу вид с места."
          ) : (
            <>
              <div className="text-mute">{ZONE_NAMES[seats[lastId].zone]}</div>
              <b className="text-base">{seatName(lastId)}</b>
              <div className="mb-2.5 mt-1.5">{formatSom(price(lastId))}</div>
              <button type="button" className="btn-primary w-full" onClick={() => setViewSeat(lastId)}>
                Посмотреть с этого места в 3D
              </button>
            </>
          )}
        </div>

        <h2 className="mt-2 text-[15px] font-semibold">Корзина</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {selected.size === 0 && <li className="text-mute">Пока пусто</li>}
          {[...selected].map((id) => (
            <li key={id} className="flex items-center gap-2">
              <span className="flex-1">
                Сектор {seats[id].sector}, ряд {seats[id].row}, место {seats[id].number}
              </span>
              <b>{formatSom(price(id))}</b>
              <button type="button" aria-label="Убрать из корзины" className="text-lg text-mute" onClick={() => toggle(id, false)}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line pt-2.5">
          <span>Итого</span>
          <b>{formatSom(total)}</b>
        </div>
        <button type="button" className="btn-primary" disabled title="Бронь и оплата подключаются на этапе 1">
          Оформить
        </button>
        <p className="text-xs text-mute">Демо: бронь и оплата подключаются на этапе 1.</p>
      </aside>
    </div>
  );
}
