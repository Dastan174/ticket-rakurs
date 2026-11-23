export type EventCategory = "concert" | "theatre" | "sport" | "humor" | "kids";

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  concert: "Концерт",
  theatre: "Театр",
  sport: "Спорт",
  humor: "Юмор",
  kids: "Детям",
};

export const formatSom = (n: number) => `${n.toLocaleString("ru-RU")} сом`;

// Время событий всегда показываем по Бишкеку, а не по часовому поясу сервера или зрителя.
const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bishkek",
});

/** «12 декабря, 19:00» */
export const formatEventDate = (iso: string) => dateFmt.format(new Date(iso)).replace(" в ", ", ");

const partFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bishkek",
});

/** Для колонки даты в афише: { day: "12", month: "дек", weekday: "сб", time: "19:00" } */
export function eventDateParts(iso: string) {
  const p = Object.fromEntries(partFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { day: p.day, month: p.month.replace(".", ""), weekday: p.weekday, time: `${p.hour}:${p.minute}` };
}
