# Инструкции для GitHub Copilot

Полные правила проекта — в [AGENTS.md](../AGENTS.md). Кратко:

- Next.js 16 (App Router, Cache Components): API отличаются от старых версий, сверяйся с `node_modules/next/dist/docs/`.
- Supabase: схема только через `supabase/migrations/`, RLS на каждой таблице, секретный ключ только на сервере.
- Бронь мест — только SQL-функции `hold_seats` / `cancel_order` / `confirm_payment` / `expire_holds`.
- Деньги — целые сомы (`int`).
- 3D-зал — Three.js в `src/components/venue/VenueViewer.tsx`, кресла одним `InstancedMesh`.
- Интерфейс на русском, код и коммиты на английском.
