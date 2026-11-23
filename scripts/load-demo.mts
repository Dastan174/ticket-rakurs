// Загружает демо-площадки и события в Supabase. Повторный запуск ничего не дублирует.
// Запуск: npm run db:load-demo (ключи из .env.local; для удалённого проекта — его URL и секретный ключ).
// Места вставляются строго в порядке generateSeats: от этого зависит event_seat_map (см. docs/venue-format.md).

import { createClient } from "@supabase/supabase-js";
import { EVENTS, LAYOUTS, ZONE_COLORS, ZONE_NAMES } from "../src/data/demo.ts";
import { generateSeats } from "../src/lib/venue/generate.ts";
import type { VenueLayout } from "../src/lib/venue/types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SECRET_KEY в .env.local");

const sb = createClient(url, key, { auth: { persistSession: false } });
const CHUNK = 1000; // лимит строк PostgREST за запрос (max_rows в supabase/config.toml)

async function must<T>(q: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await q;
  if (error) throw error;
  return data as T;
}

async function count(table: string, column: string, value: string): Promise<number> {
  const { count: n, error } = await sb.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return n ?? 0;
}

async function fetchSeats(layoutId: string) {
  const rows: { id: number; sector: number; row: number; number: number }[] = [];
  for (let from = 0; ; from += CHUNK) {
    const page = await must<typeof rows>(
      sb.from("seats").select("id, sector, row, number").eq("layout_id", layoutId).order("id").range(from, from + CHUNK - 1),
    );
    rows.push(...page);
    if (page.length < CHUNK) return rows;
  }
}

async function loadVenue(slug: string, layout: VenueLayout) {
  const [venue] = await must<{ id: string }[]>(
    sb.from("venues").upsert({ slug, name: layout.name }, { onConflict: "slug" }).select("id"),
  );
  const [vl] = await must<{ id: string }[]>(
    sb.from("venue_layouts").upsert({ venue_id: venue.id, version: 1, params: layout }, { onConflict: "venue_id,version" }).select("id"),
  );

  const seats = generateSeats(layout);
  let rows = await fetchSeats(vl.id);
  if (rows.length === 0) {
    for (let i = 0; i < seats.length; i += CHUNK) {
      await must(
        sb.from("seats").insert(
          seats.slice(i, i + CHUNK).map((s) => ({ layout_id: vl.id, sector: s.sector, row: s.row, number: s.number, x: s.x, y: s.y, z: s.z })),
        ),
      );
    }
    rows = await fetchSeats(vl.id);
  }

  // Порядок id в БД обязан совпадать с порядком генератора — иначе 3D покажет не те места.
  const mismatch = rows.length !== seats.length || rows.some((r, i) => r.sector !== seats[i].sector || r.row !== seats[i].row || r.number !== seats[i].number);
  if (mismatch) throw new Error(`${slug}: места в БД не совпадают с generateSeats. Генерация изменилась — нужна новая версия площадки.`);

  console.log(`площадка ${slug}: ${rows.length} мест`);
  return { layoutId: vl.id, seats, seatIds: rows.map((r) => r.id) };
}

const venues = new Map<string, Awaited<ReturnType<typeof loadVenue>>>();
for (const [slug, layout] of Object.entries(LAYOUTS)) venues.set(slug, await loadVenue(slug, layout));

for (const e of EVENTS) {
  const v = venues.get(e.layout)!;
  const [ev] = await must<{ id: string }[]>(
    sb
      .from("events")
      .upsert(
        { slug: e.slug, layout_id: v.layoutId, title: e.title, category: e.category, starts_at: e.startsAt, published: true, refund_rules: "не позднее чем за 3 суток до начала" },
        { onConflict: "slug" },
      )
      .select("id"),
  );

  let zones = await must<{ id: string }[]>(sb.from("price_zones").select("id").eq("event_id", ev.id).order("price", { ascending: false }));
  if (zones.length === 0) {
    zones = await must<{ id: string }[]>(
      sb.from("price_zones").insert(e.prices.map((price, i) => ({ event_id: ev.id, name: ZONE_NAMES[i], price, color: ZONE_COLORS[i] }))).select("id"),
    );
  }

  if ((await count("event_seats", "event_id", ev.id)) === 0) {
    for (let i = 0; i < v.seats.length; i += CHUNK) {
      await must(
        sb.from("event_seats").insert(
          v.seats.slice(i, i + CHUNK).map((s, j) => ({ event_id: ev.id, seat_id: v.seatIds[i + j], zone_id: zones[s.zone].id })),
        ),
      );
    }
  }
  console.log(`событие ${e.slug}: ${await count("event_seats", "event_id", ev.id)} мест`);
}
