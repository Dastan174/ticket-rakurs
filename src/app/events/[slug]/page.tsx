import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventBooking } from "@/components/booking/EventBooking";
import { getEvent } from "@/lib/events";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  return { title: event ? `${event.title} — билеты | Ракурс` : "Событие не найдено" };
}

// params — данные запроса: читаем внутри Suspense, чтобы включение Cache Components не потребовало переделок.
export default function EventPage({ params }: PageProps<"/events/[slug]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Event params={params} />
    </Suspense>
  );
}

async function Event({ params }: { params: PageProps<"/events/[slug]">["params"] }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();
  return <EventBooking event={event} />;
}
