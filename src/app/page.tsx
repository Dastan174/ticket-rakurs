import Link from "next/link";
import { EVENTS, LAYOUTS, formatSom } from "@/data/demo";

const COVERS: Record<string, string> = {
  "synthwave-night": "linear-gradient(135deg,#7c3aed,#db2777)",
  "jazz-med": "linear-gradient(135deg,#b45309,#f59e0b)",
  "cup-final": "linear-gradient(135deg,#047857,#22c55e)",
};

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-12">
      <h1 className="mb-3 text-[clamp(28px,5vw,48px)] font-bold leading-tight text-balance">Сначала посмотри — потом покупай</h1>
      <p className="mb-9 max-w-[620px] text-lg text-mute">
        Выбери место на 3D-схеме, сядь на него и осмотрись: пройдись по ряду, проверь, что сцену ничего не закрывает.
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {EVENTS.map((e) => (
          <li key={e.slug}>
            <Link
              href={`/events/${e.slug}`}
              className="block overflow-hidden rounded-2xl border border-line bg-panel transition hover:-translate-y-0.5 hover:border-[#3b4458]"
            >
              <div className="flex h-32 items-end p-3.5 text-[13px] font-semibold uppercase tracking-wide" style={{ background: COVERS[e.slug] }}>
                {e.category}
              </div>
              <div className="px-4 pb-[18px] pt-3.5">
                <h2 className="mb-1.5 text-lg font-semibold">{e.title}</h2>
                <p className="text-mute">{e.date}</p>
                <p className="text-mute">{LAYOUTS[e.layout].name}</p>
                <p className="mt-3 font-bold text-accent">от {formatSom(Math.min(...e.prices))}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
