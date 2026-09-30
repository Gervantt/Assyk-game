-- Asyq League — Фаза 6: лига университетов и пользовательские испытания.

-- ── Лига вузов ─────────────────────────────────────────────────────────────
-- Недельный рейтинг вуза = очки ежедневных испытаний его студентов
-- + победы в рейтинговых матчах за ту же неделю (по SPEC).
-- Неделя считается с понедельника; p_week_start = null означает текущую.
create or replace function public.university_league(p_week_start date default null)
returns table (
  university_id text,
  name          text,
  city          text,
  students      int,
  daily_points  int,
  ranked_wins   int,
  points        int
)
language sql
stable
security definer
set search_path = public
as $$
  with week as (
    select coalesce(p_week_start, (date_trunc('week', now()))::date) as start
  ),
  span as (
    select start, (start + 7) as stop from week
  ),
  -- студенты, которые вообще что-то сделали на этой неделе
  daily as (
    select p.university_id, sum(d.score)::int as pts, count(distinct d.user_id)::int as who
      from public.daily_results d
      join public.profiles p on p.id = d.user_id
      join span s on d.date >= s.start and d.date < s.stop
     where p.university_id is not null
     group by p.university_id
  ),
  wins as (
    select p.university_id, count(*)::int as pts, count(distinct m.winner)::int as who
      from public.matches m
      join public.profiles p on p.id = m.winner
      join span s on m.created_at >= s.start and m.created_at < s.stop
     where m.mode = 'ranked' and m.status = 'finished' and m.winner is not null
       and p.university_id is not null
     group by p.university_id
  )
  select u.id,
         u.name,
         u.city,
         greatest(coalesce(daily.who, 0), coalesce(wins.who, 0)) as students,
         coalesce(daily.pts, 0)                                   as daily_points,
         coalesce(wins.pts, 0)                                    as ranked_wins,
         coalesce(daily.pts, 0) + coalesce(wins.pts, 0) * 3       as points
    from public.universities u
    left join daily on daily.university_id = u.id
    left join wins  on wins.university_id  = u.id
   order by points desc, u.name;
$$;

grant execute on function public.university_league(date) to anon, authenticated;

-- ── Пользовательские испытания ─────────────────────────────────────────────
create table if not exists public.custom_level_likes (
  level_id   uuid not null references public.custom_levels(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (level_id, user_id)
);

alter table public.custom_level_likes enable row level security;

grant select, insert, delete on public.custom_level_likes to anon, authenticated;

drop policy if exists likes_read on public.custom_level_likes;
create policy likes_read on public.custom_level_likes
  for select using (true);

drop policy if exists likes_own on public.custom_level_likes;
create policy likes_own on public.custom_level_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Счётчики plays/likes лежат в custom_levels, но менять их напрямую нельзя:
-- политика custom_levels пускает только автора, а лайкает и играет кто угодно.
-- Поэтому обе операции — серверные функции.
create or replace function public.like_custom_level(p_level_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  total int;
begin
  if me is null then
    raise exception 'нужен вход';
  end if;

  if exists (select 1 from public.custom_level_likes
              where level_id = p_level_id and user_id = me) then
    delete from public.custom_level_likes where level_id = p_level_id and user_id = me;
  else
    insert into public.custom_level_likes (level_id, user_id) values (p_level_id, me);
  end if;

  select count(*)::int into total
    from public.custom_level_likes where level_id = p_level_id;

  update public.custom_levels set likes = total where id = p_level_id;
  return total;
end;
$$;

create or replace function public.bump_custom_plays(p_level_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.custom_levels set plays = plays + 1 where id = p_level_id;
$$;

-- Лента: популярные или свежие. Автор и «лайкнул ли я» — одним запросом,
-- иначе на каждый уровень уходил бы отдельный round-trip.
create or replace function public.list_custom_levels(
  p_sort  text default 'popular',
  p_limit int  default 30
)
returns table (
  id         uuid,
  title      text,
  layout     jsonb,
  plays      int,
  likes      int,
  created_at timestamptz,
  author_id  uuid,
  author     text,
  liked      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.title, c.layout, c.plays, c.likes, c.created_at,
         c.author_id,
         coalesce(p.username, '—') as author,
         exists (select 1 from public.custom_level_likes l
                  where l.level_id = c.id and l.user_id = auth.uid()) as liked
    from public.custom_levels c
    left join public.profiles p on p.id = c.author_id
   order by
     case when p_sort = 'new'  then extract(epoch from c.created_at) end desc nulls last,
     case when p_sort = 'mine' then extract(epoch from c.created_at) end desc nulls last,
     case when p_sort = 'popular' then (c.likes * 3 + c.plays) end desc nulls last,
     c.created_at desc
   limit least(greatest(p_limit, 1), 100);
$$;

grant execute on function public.like_custom_level(uuid)       to authenticated, anon;
grant execute on function public.bump_custom_plays(uuid)       to authenticated, anon;
grant execute on function public.list_custom_levels(text, int) to authenticated, anon;

-- Читать одно испытание по ссылке должен любой, у кого есть ссылка.
drop policy if exists custom_levels_read on public.custom_levels;
create policy custom_levels_read on public.custom_levels
  for select using (true);
