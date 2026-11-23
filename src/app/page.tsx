import Link from "next/link";
import { Suspense } from "react";
import { listEvents } from "@/lib/events";
import { CATEGORY_LABELS, eventDateParts, formatSom } from "@/lib/format";

export default function Home() {
  return (
    <main id="main" className="mx-auto w-full max-w-[880px] px-4 pb-16 pt-10 md:pt-14">
      <h1 className="max-w-[16ch] font-display text-[clamp(28px,6vw,48px)] font-bold leading-[1.08] tracking-[-0.02em] text-balance">
        Сначала посмотри с&nbsp;места, потом покупай
      </h1>
      <p className="mt-4 max-w-[52ch] text-[17px] text-mute">
        У каждого события — 3D-зал. Сядь на кресло, осмотрись и пройдись по ряду, прежде чем платить.
      </p>
      <h2 className="mt-12 mb-3 text-sm font-semibold text-mute">Ближайшие события</h2>
      <Suspense fallback={<p className="text-mute">Загружаем афишу…</p>}>
        <EventList />
      </Suspense>
    </main>
  );
}

async function EventList() {
  const events = await listEvents();
  if (events.length === 0) return <p className="text-mute">Ближайших событий пока нет.</p>;
  return (
    <ul className="divide-y divide-grout border-y border-grout">
      {events.map((e) => {
        const d = eventDateParts(e.startsAt);
        return (
          <li key={e.slug}>
            <Link
              href={`/events/${e.slug}`}
              className="group grid grid-cols-[56px_1fr] items-center gap-x-4 gap-y-1 py-4 transition-colors hover:bg-slab sm:grid-cols-[64px_1fr_auto] sm:px-3"
            >
              <div className="row-span-2 text-center leading-none sm:row-span-1">
                <div className="font-display text-[26px] font-bold">{d.day}</div>
                <div className="mt-1 text-xs text-mute">
                  {d.month}, {d.weekday}
                </div>
              </div>
              <div className="min-w-0">
                <div className="line-clamp-2 font-display text-[17px] font-medium leading-snug text-balance group-hover:underline">{e.title}</div>
                <div className="mt-1 text-sm text-mute">
                  {CATEGORY_LABELS[e.category]} · {e.venueName} · {d.time}
                </div>
              </div>
              {e.minPrice !== null && (
                <div className="col-start-2 text-sm font-semibold sm:col-start-auto sm:text-right">от {formatSom(e.minPrice)}</div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
