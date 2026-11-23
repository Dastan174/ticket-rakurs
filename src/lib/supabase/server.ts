import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Клиент от имени вошедшего пользователя (Server Components, Server Actions, Route Handlers). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Вызов из Server Component: куки там менять нельзя, сессию обновит proxy (этап 1).
        }
      },
    },
  });
}

/** Полные права в обход RLS. Только для webhook оплаты и админки, никогда не отдавать в клиент. */
export function createAdminClient() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}
