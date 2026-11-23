"use client";

// Экран выбора мест: 3D-зал, панель с местом и выбранными билетами.
// Площадка и цены приходят с сервера, статусы мест — отдельным rpc('event_seat_map') из браузера (свежие, не кешируются).
// Бронь через rpc('hold_seats') — следующий шаг этапа 1 (docs/booking.md).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Close, Eye } from "@/components/icons";
import type { EventDetail } from "@/lib/events";
import { CATEGORY_LABELS, formatEventDate, formatSom } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { generateSeats } from "@/lib/venue/generate";
import { applySeatMap, type SeatMapRow } from "@/lib/venue/seat-map";

type SeatState = ReturnType<typeof applySeatMap>;

// Three.js — самый тяжёлый кусок страницы. Грузим его отдельно: цены, места и кнопка работают раньше 3D.
const loadViewer = () => import("@/components/venue/VenueViewer");
const VenueViewer = dynamic(() => loadViewer().then((m) => m.VenueViewer), { ssr: false });

const ticketWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "место" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "места" : "мест");

/** Подсказка в двух вариантах: мышь и касание (pointer: coarse) */
const Hint = ({ mouse, touch }: { mouse: string; touch: string }) => (
  <>
    <span className="pointer-coarse:hidden">{mouse}</span>
    <span className="hidden pointer-coarse:inline">{touch}</span>
  </>
);

export function EventBooking({ event }: { event: EventDetail }) {
  const base = useMemo(() => generateSeats(event.layout), [event.layout]);
  const [state, setState] = useState<SeatState | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadViewer(); // качаем 3D параллельно с картой мест, а не после неё
    createClient()
      .rpc("event_seat_map", { p_event_id: event.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        try {
          if (error || !data) throw error ?? new Error("пустой ответ");
          setState(applySeatMap(base, data as SeatMapRow));
        } catch (e) {
          console.error(e);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, base]);

  const seats = state?.seats ?? base;
  const unavailable = state?.unavailable;
  const zoneColors = useMemo(() => event.zones.map((z) => z.color), [event.zones]);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [focusId, setFocusId] = useState<number | null>(null);
  const [centerId, setCenterId] = useState<number | null>(null);
  const [viewSeat, setViewSeat] = useState<number | null>(null);
  const [tip, setTip] = useState<{ id: number; x: number; y: number } | null>(null);
  const [limitHit, setLimitHit] = useState(false);

  const seatName = (id: number) => {
    const s = seats[id];
    return `Сектор ${s.sector} · ряд ${s.row} · место ${s.number}`;
  };
  const price = (id: number) => event.zones[seats[id].zone]?.price ?? 0;
  const toggle = (id: number, force?: boolean) => {
    const on = force ?? !selected.has(id);
    setFocusId(id);
    if (on && !selected.has(id) && selected.size >= event.maxPerUser) {
      setLimitHit(true);
      return;
    }
    setLimitHit(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const total = [...selected].reduce((sum, id) => sum + price(id), 0);
  const freeCount = useMemo(() => (unavailable ? unavailable.length - unavailable.reduce((a, b) => a + b, 0) : null), [unavailable]);
  // Строка-ориентир: место в фокусе, а если его нет — что в центре кадра («направляющие слова» словарной страницы)
  const focus = viewSeat ?? tip?.id ?? focusId;

  const titleBlock = (
    <>
      <h1 className="font-display text-[24px] font-bold leading-[1.12] tracking-[-0.02em] text-balance">{event.title}</h1>
      <p className="mt-1.5 text-sm text-mute">
        {CATEGORY_LABELS[event.category]} · {formatEventDate(event.startsAt)} · {event.venueName}
      </p>
    </>
  );

  return (
    <main
      id="main"
      className="grid min-h-0 flex-1 grid-rows-[auto_min(40vh,360px)_auto] md:h-[calc(100dvh-3.5rem)] md:grid-cols-[1fr_360px] md:grid-rows-1"
    >
      {/* Телефон: название над 3D, «назад» рядом с ним */}
      <div className="px-4 pb-3 pt-3 md:hidden">
        <Link href="/" className="mb-1 inline-flex items-center gap-1 text-sm text-mute hover:text-ink">
          <ArrowLeft width={16} height={16} /> Афиша
        </Link>
        {titleBlock}
      </div>

      <div className="relative min-h-0 bg-night">
        {!unavailable && (
          <p className="absolute inset-0 grid place-items-center px-4 text-center text-concrete/70" role="status">
            {loadError ? "Не удалось загрузить места. Обновите страницу." : "Загружаем места…"}
          </p>
        )}
        {unavailable && (
          <VenueViewer
            layout={event.layout}
            seats={seats}
            unavailable={unavailable}
            zoneColors={zoneColors}
            selected={selected}
            screenTitle={event.title}
            viewSeat={viewSeat}
            onSeatClick={(id) => toggle(id)}
            onSeatOpen={(id) => {
              toggle(id, true);
              setViewSeat(id);
            }}
            onHover={(id, x, y) => setTip(id === null ? null : { id, x, y })}
            onCenter={setCenterId}
            onExitView={() => setViewSeat(null)}
          />
        )}
        {tip && unavailable && viewSeat === null && (
          <div className="on-night pointer-events-none absolute whitespace-nowrap px-2.5 py-1.5 text-[13px]" style={{ left: tip.x + 12, top: tip.y + 12 }}>
            {seatName(tip.id)} · {unavailable[tip.id] ? "занято" : <b>{formatSom(price(tip.id))}</b>}
          </div>
        )}
        {unavailable && viewSeat !== null && (
          <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-2">
            <button type="button" className="on-night inline-flex items-center gap-1 py-2 pl-2 pr-3.5 text-sm font-medium" onClick={() => setViewSeat(null)}>
              <ArrowLeft /> К схеме
            </button>
            <button
              type="button"
              className={`ml-auto inline-flex items-center gap-1.5 rounded-tile px-3.5 py-2 text-sm font-semibold ${selected.has(viewSeat) ? "on-night" : "bg-gold text-ink"}`}
              onClick={() => toggle(viewSeat)}
            >
              {selected.has(viewSeat) ? (
                <>
                  <Check /> Выбрано
                </>
              ) : (
                `Выбрать за ${formatSom(price(viewSeat))}`
              )}
            </button>
          </div>
        )}
        {unavailable && (
          <p className="on-night absolute bottom-3 left-3 right-3 truncate px-3 py-1.5 text-[13px] sm:right-auto">
            {viewSeat === null ? (
              <Hint mouse="Клик — выбрать · двойной клик — сесть на место" touch="Нажми — выбрать · дважды — сесть" />
            ) : (
              <Hint mouse="Тяни — осмотреться · WASD — идти · Esc — назад" touch="Тяни — осмотреться · стрелки — идти" />
            )}
          </p>
        )}
      </div>

      <aside className="flex flex-col border-t border-grout bg-concrete md:min-h-0 md:border-l md:border-t-0">
        <div className="flex flex-col gap-4 p-4 md:min-h-0 md:flex-1 md:gap-5 md:overflow-auto md:p-5">
          <div className="hidden md:block">
            <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-mute hover:text-ink">
              <ArrowLeft width={16} height={16} /> Афиша
            </Link>
            {titleBlock}
          </div>

          <div className="rounded-tile bg-slab p-3 text-sm" aria-live="polite">
            {focus === null ? (
              centerId !== null ? (
                <div className="flex items-center gap-3">
                  <span className="tile size-4" style={{ background: zoneColors[seats[centerId].zone] }} />
                  <span>
                    В кадре: <b>сектор {seats[centerId].sector} · ряд {seats[centerId].row}</b>
                  </span>
                </div>
              ) : (
                <span className="text-mute">
                  <Hint mouse="Нажми на кресло в зале. Двойной клик — сесть на него и посмотреть." touch="Нажми на кресло в зале. Двойное касание — сесть на него." />
                </span>
              )
            ) : (
              <div className="flex items-center gap-3">
                <span className="tile size-4" style={{ background: unavailable?.[focus] ? "var(--color-sold)" : zoneColors[seats[focus].zone] }} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{seatName(focus)}</div>
                  <div className="text-mute">
                    {unavailable?.[focus] ? "Занято" : `${event.zones[seats[focus].zone]?.name} · ${formatSom(price(focus))}`}
                  </div>
                </div>
                {viewSeat === null && !unavailable?.[focus] && (
                  <button type="button" className="btn-quiet shrink-0 px-2.5" onClick={() => setViewSeat(focus)} aria-label="Посмотреть с этого места">
                    <Eye />
                  </button>
                )}
              </div>
            )}
          </div>

          <section>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <h2 className="font-semibold">Цены</h2>
              {freeCount !== null && <span className="text-mute">свободно {freeCount.toLocaleString("ru-RU")}</span>}
            </div>
            {/* Телефон — одна строка плиток, десктоп — столбец */}
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm md:grid md:gap-1.5">
              {event.zones.map((z) => (
                <li key={z.name} className="flex items-center gap-2 md:gap-2.5">
                  <span className="tile" style={{ background: z.color }} />
                  <span className="md:flex-1">{z.name}</span>
                  <span className="font-medium">{formatSom(z.price)}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 text-mute md:gap-2.5">
                <span className="tile bg-sold" />
                <span>Занято</span>
              </li>
            </ul>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between text-sm">
              <h2 className="font-semibold">Ваши места</h2>
              {/* Слоты: видно, сколько ещё можно взять (из вкладыша кассеты) */}
              <div className="flex items-center gap-1.5" aria-label={`Выбрано ${selected.size} из ${event.maxPerUser}`}>
                {Array.from({ length: event.maxPerUser }, (_, i) => (
                  <span
                    key={i}
                    className={`slot tile size-3.5 ${i < selected.size ? "scale-100 bg-gold" : "scale-90 bg-slab"}`}
                    style={{ transition: "transform 220ms var(--ease-out-expo), background-color 220ms" }}
                  />
                ))}
              </div>
            </div>
            {limitHit && (
              <p role="status" className="mb-2 text-sm text-brick">
                Не больше {event.maxPerUser} мест на человека.
              </p>
            )}
            <ul className="grid gap-1 text-sm">
              {selected.size === 0 && <li className="text-mute">Пока ничего не выбрано</li>}
              {[...selected].map((id) => (
                <li key={id} className="flex items-center gap-2.5 rounded-tile py-1">
                  <span className="tile bg-gold" />
                  <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => setFocusId(id)}>
                    {seatName(id)}
                  </button>
                  <span className="font-medium">{formatSom(price(id))}</span>
                  <button type="button" aria-label={`Убрать: ${seatName(id)}`} className="-mr-1 rounded-tile p-1 text-mute hover:text-ink" onClick={() => toggle(id, false)}>
                    <Close width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {event.refundRules && <p className="text-xs text-mute">Возврат билетов {event.refundRules}.</p>}
        </div>

        <div className="sticky bottom-0 border-t border-grout bg-concrete px-4 py-3 md:p-5">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-sm text-mute">{selected.size ? `${selected.size} ${ticketWord(selected.size)}` : "Итого"}</span>
            <span className="font-display text-[22px] font-bold">{formatSom(total)}</span>
          </div>
          <button type="button" className="btn-primary w-full" disabled title="Бронь подключается на этапе 1">
            {selected.size ? `Забронировать ${selected.size} ${ticketWord(selected.size)}` : "Выбери места"}
          </button>
          <p className="mt-2 hidden text-center text-xs text-mute md:block">Бронь и оплата появятся на следующем этапе</p>
        </div>
      </aside>
    </main>
  );
}
