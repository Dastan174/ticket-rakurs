import Link from "next/link";
import { Suspense } from "react";
import { listEvents } from "@/lib/events";
import { CATEGORY_LABELS, formatEventDate, formatSom, type EventCategory } from "@/lib/format";

// shortcut: обложка по категории, пока у событий нет афиш (появятся в R2 вместе с кабинетом организатора).
const COVERS: Record<EventCategory, string> = {
  concert: "linear-gradient(135deg,#7c3aed,#db2777)",
  theatre: "linear-gradient(135deg,#b45309,#f59e0b)",
  sport: "linear-gradient(135deg,#047857,#22c55e)",
  humor: "linear-gradient(135deg,#be123c,#fb7185)",
  kids: "linear-gradient(135deg,#0369a1,#38bdf8)",
};

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-12">
      <h1 className="mb-3 text-[clamp(28px,5vw,48px)] font-bold leading-tight text-balance">Сначала посмотри — потом покупай</h1>
      <p className="mb-9 max-w-[620px] text-lg text-mute">
        Выбери место на 3D-схеме, сядь на него и осмотрись: пройдись по ряду, проверь, что сцену ничего не закрывает.
      </p>
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
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      {events.map((e) => (
        <li key={e.slug}>
          <Link
            href={`/events/${e.slug}`}
            className="block overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-[#3b4458]"
          >
            <div className="flex h-32 items-end p-3.5 text-[13px] font-semibold uppercase tracking-wide" style={{ background: COVERS[e.category] }}>
              {CATEGORY_LABELS[e.category]}
            </div>
            <div className="px-4 pb-[18px] pt-3.5">
              <h2 className="mb-1.5 text-lg font-semibold">{e.title}</h2>
              <p className="text-mute">{formatEventDate(e.startsAt)}</p>
              <p className="text-mute">{e.venueName}</p>
              {e.minPrice !== null && <p className="mt-3 font-bold text-accent">от {formatSom(e.minPrice)}</p>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
