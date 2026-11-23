-- Карта мест события одним запросом: id, статус и ценовая зона каждого места в порядке seat_id.
-- Порядок seat_id совпадает с порядком generateSeats (места вставляются в этом порядке, см. docs/venue-format.md),
-- поэтому клиент строит 3D из params площадки и накладывает на него эти строки по индексу.
-- status: '0' — свободно (в т.ч. просроченная бронь), '1' — недоступно.
-- zone: индекс зоны в списке price_zones, отсортированном по цене (дороже — меньше индекс).
-- shortcut: зона кодируется одной цифрой, значит не больше 10 зон на событие; перейти на массив, если понадобится больше.

create function public.event_seat_map(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with z as (
    select id, (row_number() over (order by price desc, name) - 1)::int as idx
    from public.price_zones
    where event_id = p_event_id
  )
  select jsonb_build_object(
    'ids', coalesce(jsonb_agg(es.seat_id order by es.seat_id), '[]'::jsonb),
    'status', coalesce(string_agg(
      case when es.status = 'free' or (es.status = 'held' and es.hold_until < now()) then '0' else '1' end,
      '' order by es.seat_id), ''),
    'zone', coalesce(string_agg(z.idx::text, '' order by es.seat_id), '')
  )
  from public.event_seats es
  join z on z.id = es.zone_id
  join public.events e on e.id = es.event_id and e.published
  where es.event_id = p_event_id
$$;

revoke execute on function public.event_seat_map(uuid) from public;
grant execute on function public.event_seat_map(uuid) to anon, authenticated;
