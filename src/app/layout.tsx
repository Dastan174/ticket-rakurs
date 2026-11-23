import type { Metadata, Viewport } from "next";
import { Golos_Text, Unbounded } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const golos = Golos_Text({ variable: "--font-golos", subsets: ["latin", "cyrillic"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin", "cyrillic"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Ракурс — билеты с видом с места",
  description: "Билеты на концерты, спорт и театр в Бишкеке. Перед покупкой сядь на своё место в 3D.",
};

export const viewport: Viewport = { themeColor: "#d6d3cc" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${golos.variable} ${unbounded.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-10 focus:rounded-tile focus:bg-ink focus:px-3 focus:py-2 focus:text-concrete">
          Перейти к содержимому
        </a>
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-grout px-4 md:px-6">
          <Link href="/" translate="no" className="flex items-center gap-2 font-display text-[17px] font-bold">
            {/* Знак — кобальтовая плитка смальты: переживёт смену рабочего названия. Золото не трогаем — оно для мест покупателя */}
            <span aria-hidden className="tile size-3.5 bg-cobalt" />
            Ракурс
          </Link>
          <span className="hidden text-sm text-mute sm:block">Билеты с видом с места · Бишкек</span>
        </header>
        {children}
      </body>
    </html>
  );
}
