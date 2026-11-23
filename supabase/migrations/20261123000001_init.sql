-- Ракурс: базовая схема. Правила — docs/database.md, логика брони — docs/booking.md.
-- Деньги храним целыми сомами (int), время — timestamptz.

create type public.seat_status as enum ('free', 'held', 'sold', 'blocked');
create type public.order_status as enum ('pending', 'paid', 'expired', 'cancelled', 'refund_required', 'refunded');
create type public.user_role as enum ('buyer', 'organizer', 'controller', 'admin');
create type public.event_category as enum ('concert', 'theatre', 'sport', 'humor', 'kids');

-- ---------- справочники ----------
create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  phone text,
  role public.user_role not null default 'buyer',
  organizer_id uuid references public.organizers (id),
  created_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text,
  lat double precision,
  lng double precision
);

-- params — JSON площадки по формату docs/venue-format.md (тип VenueLayout в src/lib/venue/types.ts)
create table public.venue_layouts (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  version int not null,
  params jsonb not null,
  scene_url text,
  created_at timestamptz not null default now(),
  unique (venue_id, version)
);

create table public.seats (
  id bigint generated always as identity primary key,
  layout_id uuid not null references public.venue_layouts (id) on delete cascade,
  sector int not null,
  row int not null,
  number int not null,
  x real not null,
  y real not null,
  z real not null,
  view_limited boolean not null default false,
  unique (layout_id, sector, row, number)
);

-- ---------- события ----------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  layout_id uuid not null references public.venue_layouts (id),
  organizer_id uuid references public.organizers (id),
  title text not null,
  category public.event_category not null,
  starts_at timestamptz not null,
  sale_starts_at timestamptz not null default now(),
  is_hot boolean not null default false,
  max_per_user int not null default 6 check (max_per_user between 1 and 20),
  refund_rules text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.price_zones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  price int not null check (price >= 0),
  color text not null default '#5b8cff'
);

create table public.event_seats (
  event_id uuid not null references public.events (id) on delete cascade,
  seat_id bigint not null references public.seats (id),
  zone_id uuid not null references public.price_zones (id),
  status public.seat_status not null default 'free',
  order_id uuid,
  hold_until timestamptz,
  primary key (event_id, seat_id)
);
create index event_seats_order_idx on public.event_seats (order_id) where order_id is not null;
create index event_seats_hold_idx on public.event_seats (hold_until) where status = 'held';

-- ---------- заказы и билеты ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  event_id uuid not null references public.events (id),
  status public.order_status not null default 'pending',
  total int not null default 0,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id);
create index orders_pending_idx on public.orders (expires_at) where status = 'pending';

create table public.order_items (
  order_id uuid not null references public.orders (id) on delete cascade,
  seat_id bigint not null references public.seats (id),
  price int not null,
  primary key (order_id, seat_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  event_id uuid not null references public.events (id),
  seat_id bigint not null references public.seats (id),
  code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, seat_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- бронь ----------
-- Атомарно: либо все места заказа, либо ни одного (исключение откатывает и созданный заказ).
create function public.hold_seats(p_event_id uuid, p_seat_ids bigint[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_event public.events;
  v_ids bigint[] := array(select distinct unnest(p_seat_ids));
  v_order uuid;
  v_expires timestamptz := now() + interval '10 minutes';
  v_taken int;
  v_total int;
  v_already int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if coalesce(cardinality(v_ids), 0) = 0 then raise exception 'no_seats'; end if;

  select * into v_event from public.events where id = p_event_id and published;
  if not found then raise exception 'event_not_found'; end if;
  if v_event.sale_starts_at > now() then raise exception 'sale_not_started'; end if;

  -- shortcut: проверка не под блокировкой, две параллельные брони одного человека могут превысить лимит;
  -- добавить pg_advisory_xact_lock по (user, event), если появятся перекупщики.
  select count(*) into v_already
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.user_id = v_user and o.event_id = p_event_id
    and (o.status = 'paid' or (o.status = 'pending' and o.expires_at > now()));
  if v_already + cardinality(v_ids) > v_event.max_per_user then raise exception 'limit_exceeded'; end if;

  insert into public.orders (user_id, event_id, expires_at)
  values (v_user, p_event_id, v_expires) returning id into v_order;

  with taken as (
    update public.event_seats es
    set status = 'held', order_id = v_order, hold_until = v_expires
    where es.event_id = p_event_id
      and es.seat_id = any (v_ids)
      and (es.status = 'free' or (es.status = 'held' and es.hold_until < now()))
    returning es.seat_id, es.zone_id
  ), items as (
    insert into public.order_items (order_id, seat_id, price)
    select v_order, t.seat_id, pz.price from taken t join public.price_zones pz on pz.id = t.zone_id
    returning price
  )
  select count(*), coalesce(sum(price), 0) into v_taken, v_total from items;

  if v_taken <> cardinality(v_ids) then raise exception 'seats_taken'; end if;

  update public.orders set total = v_total where id = v_order;
  return v_order;
end;
$$;

-- Покупатель сам отменяет свою неоплаченную бронь.
create function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders set status = 'cancelled'
  where id = p_order_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'order_not_found'; end if;

  update public.event_seats set status = 'free', order_id = null, hold_until = null
  where order_id = p_order_id and status = 'held';
end;
$$;

-- Вызывает только сервер из webhook оплаты (service_role). Идемпотентна.
-- Возвращает 'paid' или 'refund_required' (оплата пришла, но места уже ушли — нужен возврат денег).
create function public.confirm_payment(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_need int;
  v_ok int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status in ('paid', 'refund_required', 'refunded') then return v_order.status::text; end if;

  select count(*) into v_need from public.order_items where order_id = p_order_id;

  -- Место ещё наше (даже если таймер истёк) или освободилось и никто его не взял.
  perform 1 from public.event_seats es join public.order_items oi on oi.seat_id = es.seat_id
  where oi.order_id = p_order_id and es.event_id = v_order.event_id
  for update of es;

  select count(*) into v_ok
  from public.event_seats es join public.order_items oi on oi.seat_id = es.seat_id
  where oi.order_id = p_order_id and es.event_id = v_order.event_id
    and ((es.status = 'held' and (es.order_id = p_order_id or es.hold_until < now())) or es.status = 'free');

  if v_ok < v_need then
    update public.orders set status = 'refund_required' where id = p_order_id;
    return 'refund_required';
  end if;

  update public.event_seats es set status = 'sold', order_id = p_order_id, hold_until = null
  from public.order_items oi
  where oi.order_id = p_order_id and es.seat_id = oi.seat_id and es.event_id = v_order.event_id;

  insert into public.tickets (order_id, event_id, seat_id)
  select p_order_id, v_order.event_id, seat_id from public.order_items where order_id = p_order_id;

  update public.orders set status = 'paid', paid_at = now() where id = p_order_id;
  return 'paid';
end;
$$;

-- Освобождает просроченные брони. Запускается pg_cron (следующая миграция).
create function public.expire_holds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  update public.event_seats set status = 'free', order_id = null, hold_until = null
  where status = 'held' and hold_until < now();
  get diagnostics v_count = row_count;

  update public.orders set status = 'expired' where status = 'pending' and expires_at < now();
  return v_count;
end;
$$;

revoke execute on function public.hold_seats(uuid, bigint[]) from public, anon;
revoke execute on function public.cancel_order(uuid) from public, anon;
revoke execute on function public.confirm_payment(uuid) from public, anon, authenticated;
revoke execute on function public.expire_holds() from public, anon, authenticated;
grant execute on function public.hold_seats(uuid, bigint[]) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.confirm_payment(uuid) to service_role;
grant execute on function public.expire_holds() to service_role;

-- ---------- RLS ----------
alter table public.organizers enable row level security;
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.venue_layouts enable row level security;
alter table public.seats enable row level security;
alter table public.events enable row level security;
alter table public.price_zones enable row level security;
alter table public.event_seats enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.tickets enable row level security;
alter table public.audit_log enable row level security;

create policy "public read" on public.venues for select using (true);
create policy "public read" on public.venue_layouts for select using (true);
create policy "public read" on public.seats for select using (true);
create policy "published events" on public.events for select using (published);
create policy "zones of published events" on public.price_zones for select
  using (exists (select 1 from public.events e where e.id = event_id and e.published));
create policy "seats of published events" on public.event_seats for select
  using (exists (select 1 from public.events e where e.id = event_id and e.published));

create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());
create policy "own orders" on public.orders for select using (user_id = auth.uid());
create policy "own order items" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "own tickets" on public.tickets for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Чужой order_id не должен утекать: клиенту видны только статусы мест.
revoke select on public.event_seats from anon, authenticated;
grant select (event_id, seat_id, zone_id, status) on public.event_seats to anon, authenticated;
-- Роль меняет только админ (service_role), сам пользователь — только имя и телефон.
revoke update on public.profiles from anon, authenticated;
grant update (name, phone) on public.profiles to authenticated;
