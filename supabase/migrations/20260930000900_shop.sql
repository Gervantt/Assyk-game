-- Asyq League — Фаза 7: магазин косметики, тестовые покупки, экипировка.
--
-- Никакого pay-to-win: всё продаваемое — только внешний вид. Физика скины
-- не читает вовсе (тип скина не импортируется в src/physics, это проверяет тест).
--
-- Цены лежат в БД, а не в клиенте: иначе их подменили бы в браузере и
-- «купили» бы что угодно за ноль.

create table if not exists public.shop_items (
  id          text primary key,
  kind        text not null check (kind in ('saka','arena','trail','pack','tool')),
  -- цена в тиынах (зарабатываются игрой). 0 — не продаётся за тиын
  price_coins int  not null default 0 check (price_coins >= 0),
  -- цена «деньгами» в тестовом режиме, ₸. 0 — не продаётся за деньги
  price_kzt   int  not null default 0 check (price_kzt >= 0),
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.shop_items enable row level security;

drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select using (true);

grant select on public.shop_items to anon, authenticated;

-- ── Что надето ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists equipped jsonb not null default '{}'::jsonb;

-- ── Ассортимент ────────────────────────────────────────────────────────────
insert into public.shop_items (id, kind, price_coins, price_kzt, sort) values
  ('saka.red',      'saka',     0,    0,  10),
  ('saka.bone',     'saka',   120,    0,  20),
  ('saka.silver',   'saka',   260,    0,  30),
  ('saka.gold',     'saka',   540,    0,  40),
  ('saka.oyu',      'saka',     0,  990,  50),
  ('arena.aul',     'arena',    0,    0, 110),
  ('arena.almaty',  'arena',  180,    0, 120),
  ('arena.jailau',  'arena',  320,    0, 130),
  ('arena.winter',  'arena',    0,  990, 140),
  ('trail.dust',    'trail',    0,    0, 210),
  ('trail.spark',   'trail',  150,    0, 220),
  ('trail.gold',    'trail',    0,  690, 230),
  ('pack.uly-dala', 'pack',     0, 1490, 310),
  ('pack.tarih',    'pack',     0, 1490, 320),
  ('tool.tournament','tool',    0, 2490, 410)
on conflict (id) do update
  set kind = excluded.kind,
      price_coins = excluded.price_coins,
      price_kzt = excluded.price_kzt,
      sort = excluded.sort;

-- ── Начисление тиынов за игру ──────────────────────────────────────────────
-- Монеты зарабатываются игрой, поэтому начисление обязано быть серверным,
-- да ещё и с потолком: иначе один вызов в цикле сделал бы любого богачом.
create or replace function public.award_coins(p_amount int, p_reason text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me      uuid := auth.uid();
  capped  int;
  today   int;
  total   int;
begin
  if me is null then
    raise exception 'нужен вход';
  end if;

  capped := least(greatest(p_amount, 0), 50);

  -- дневной потолок: столько же, сколько даёт честная игра за вечер
  select coalesce(sum((r.score))::int, 0) into today
    from public.results r
   where r.user_id = me and r.created_at >= current_date;

  if today > 400 then
    capped := 0;
  end if;

  perform set_config('app.privileged', 'on', true);
  update public.profiles set coins = coins + capped where id = me
  returning coins into total;
  perform set_config('app.privileged', 'off', true);

  return total;
end;
$$;

-- ── Покупка ────────────────────────────────────────────────────────────────
-- Тестовый режим: «оплата» деньгами ничего не списывает, но покупка реально
-- записывается и предмет действительно открывается. Покупка за тиыны
-- списывает их по-настоящему.
create or replace function public.buy_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  item  public.shop_items;
  have  int;
begin
  if me is null then
    raise exception 'нужен вход';
  end if;

  select * into item from public.shop_items where id = p_item_id;
  if not found then
    raise exception 'нет такого предмета';
  end if;

  if exists (select 1 from public.purchases where user_id = me and item_id = p_item_id) then
    return jsonb_build_object('owned', true, 'coins', (select coins from public.profiles where id = me));
  end if;

  if item.price_coins > 0 then
    select coins into have from public.profiles where id = me;
    if have < item.price_coins then
      raise exception 'не хватает тиынов';
    end if;
    perform set_config('app.privileged', 'on', true);
    update public.profiles set coins = coins - item.price_coins where id = me;
    perform set_config('app.privileged', 'off', true);
  end if;

  insert into public.purchases (user_id, item_id, test_mode)
  values (me, p_item_id, item.price_kzt > 0)
  on conflict (user_id, item_id) do nothing;

  return jsonb_build_object(
    'owned', true,
    'coins', (select coins from public.profiles where id = me),
    'test_mode', item.price_kzt > 0
  );
end;
$$;

-- ── Экипировка ─────────────────────────────────────────────────────────────
-- Надеть можно только то, что действительно есть: бесплатное или купленное.
create or replace function public.equip_item(p_item_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me   uuid := auth.uid();
  item public.shop_items;
  cur  jsonb;
begin
  if me is null then
    raise exception 'нужен вход';
  end if;

  select * into item from public.shop_items where id = p_item_id;
  if not found then
    raise exception 'нет такого предмета';
  end if;
  if item.kind not in ('saka','arena','trail') then
    raise exception 'этот предмет не надевается';
  end if;

  if item.price_coins > 0 or item.price_kzt > 0 then
    if not exists (select 1 from public.purchases where user_id = me and item_id = p_item_id) then
      raise exception 'предмет не куплен';
    end if;
  end if;

  select equipped into cur from public.profiles where id = me;
  cur := coalesce(cur, '{}'::jsonb) || jsonb_build_object(item.kind, p_item_id);

  update public.profiles set equipped = cur where id = me;
  return cur;
end;
$$;

grant execute on function public.award_coins(int, text) to authenticated, anon;
grant execute on function public.buy_item(text)          to authenticated, anon;
grant execute on function public.equip_item(text)        to authenticated, anon;
