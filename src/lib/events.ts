import "server-only";
import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import type { EventCategory } from "@/lib/format";
import type { VenueLayout } from "@/lib/venue/types";

// Каталог публичный: ни сессия, ни cookies не нужны, поэтому обычный клиент без @supabase/ssr.
function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

export interface PriceZone {
  name: string;
  price: number;
  color: string;
}

export interface EventCard {
  slug: string;
  title: string;
  category: EventCategory;
  startsAt: string;
  venueName: string;
  minPrice: number | null;
}

export interface EventDetail extends EventCard {
  id: string;
  refundRules: string;
  maxPerUser: number;
  layout: VenueLayout;
  /** По убыванию цены — тот же порядок, что индексы зон в event_seat_map */
  zones: PriceZone[];
}

interface EventRow {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  starts_at: string;
  refund_rules: string;
  max_per_user: number;
  price_zones: PriceZone[];
  venue_layouts: { params: VenueLayout; venues: { name: string } };
}

const SELECT = "id, slug, title, category, starts_at, refund_rules, max_per_user, price_zones(name, price, color), venue_layouts(params, venues(name))";

const toCard = (r: EventRow): EventCard => ({
  slug: r.slug,
  title: r.title,
  category: r.category,
  startsAt: r.starts_at,
  venueName: r.venue_layouts.venues.name,
  minPrice: r.price_zones.length ? Math.min(...r.price_zones.map((z) => z.price)) : null,
});

/** Предстоящие опубликованные события, ближайшие первыми. */
export async function listEvents(): Promise<EventCard[]> {
  await connection(); // данные меняются — рендерим на каждый запрос, а не при сборке
  const { data, error } = await publicClient()
    .from("events")
    .select(SELECT)
    .eq("published", true)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");
  if (error) throw error;
  return (data as unknown as EventRow[]).map(toCard);
}

export async function getEvent(slug: string): Promise<EventDetail | null> {
  await connection();
  const { data, error } = await publicClient()
    .from("events")
    .select(SELECT)
    .eq("slug", slug)
    .eq("published", true)
    .order("price", { referencedTable: "price_zones", ascending: false })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as EventRow;
  return { ...toCard(r), id: r.id, refundRules: r.refund_rules, maxPerUser: r.max_per_user, layout: r.venue_layouts.params, zones: r.price_zones };
}
