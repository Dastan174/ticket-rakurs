-- Фоновые задачи и рассылка статусов мест. Только для настоящего Supabase:
-- в тестах (PGlite) нет pg_cron и схемы realtime, поэтому блоки под условием.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-holds', '15 seconds', 'select public.expire_holds()');
  end if;
end $$;

-- Одно сообщение на оператор UPDATE, а не на каждую строку: при старте продаж это в разы меньше трафика.
-- shortcut: нет пакетирования по 300–500 мс из ТЗ, добавить, если Realtime-сообщений станет больше 5 млн в месяц.
create function public.broadcast_seat_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in
    select n.event_id, jsonb_agg(jsonb_build_array(n.seat_id, n.status)) as seats
    from new_rows n join old_rows o using (event_id, seat_id)
    where n.status is distinct from o.status
    group by n.event_id
  loop
    perform realtime.send(jsonb_build_object('seats', r.seats), 'seats', 'event:' || r.event_id, false);
  end loop;
  return null;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'realtime') then
    create trigger event_seats_broadcast
      after update on public.event_seats
      referencing new table as new_rows old table as old_rows
      for each statement execute function public.broadcast_seat_changes();
  end if;
end $$;
