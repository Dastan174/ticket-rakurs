import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Ракурс — билеты с видом с места",
  description: "Билеты на концерты, спорт и театр в Бишкеке. Перед покупкой сядь на своё место в 3D.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-5">
          <Link href="/" className="text-xl font-extrabold">
            Ракурс<span className="text-accent">.</span>
          </Link>
          <span className="text-mute">билеты с видом с места</span>
        </header>
        {children}
      </body>
    </html>
  );
}
