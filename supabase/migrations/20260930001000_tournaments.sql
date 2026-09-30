-- Asyq League — Фаза 7: частные турниры на 4 и 8 игроков.
--
-- Сетка на выбывание. Матчи турнира — обычные строки matches (mode =
-- 'tournament'), поэтому играются тем же кодом и той же физикой, что и
-- матч по ссылке. Кто победил, турнир НЕ берёт со слов клиента: функция
-- продвижения читает matches.winner.

create table if not exists public.tournament_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  seed_no       int  not null,
  joined_at     timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

alter table public.tournament_players enable row level security;

drop policy if exists tournament_players_read on public.tournament_players;
create policy tournament_players_read on public.tournament_players
  for select using (true);

grant select on public.tournament_players to anon, authenticated;

-- Турнир виден всем, у кого есть ссылка; менять может только владелец.
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select using (true);

-- ── Создание ───────────────────────────────────────────────────────────────
create or replace function public.create_tournament(
  p_title text,
  p_size  int,
  p_rules jsonb default '{}'::jsonb
)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  t  public.tournaments;
begin
  if me is null then
    raise exception 'нужен вход';
  end if;
  if p_size not in (4, 8) then
    raise exception 'размер турнира: 4 или 8';
  end if;

  insert into public.tournaments (owner_id, title, size, rules, status)
  values (me, p_title, p_size, coalesce(p_rules, '{}'::jsonb), 'open')
  returning * into t;

  insert into public.tournament_players (tournament_id, user_id, seed_no)
  values (t.id, me, 1);

  return t;
end;
$$;

-- ── Вступление по ссылке ───────────────────────────────────────────────────
create or replace function public.join_tournament(p_id uuid)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  t     public.tournaments;
  taken int;
begin
  if me is null then
    raise exception 'нужен вход';
  end if;

  select * into t from public.tournaments where id = p_id for update;
  if not found then
    raise exception 'турнир не найден';
  end if;
  if exists (select 1 from public.tournament_players
              where tournament_id = p_id and user_id = me) then
    return t;
  end if;
  if t.status <> 'open' then
    raise exception 'турнир уже начался';
  end if;

  select count(*) into taken from public.tournament_players where tournament_id = p_id;
  if taken >= t.size then
    raise exception 'мест нет';
  end if;

  insert into public.tournament_players (tournament_id, user_id, seed_no)
  values (p_id, me, taken + 1);

  return t;
end;
$$;

-- ── Старт: строим сетку и заводим матчи первого круга ─────────────────────
create or replace function public.start_tournament(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  t        public.tournaments;
  ids      uuid[];
  rounds   jsonb := '[]'::jsonb;
  first    jsonb := '[]'::jsonb;
  i        int;
  a        uuid;
  b        uuid;
  mid      uuid;
  sd       bigint;
  fx       int;
  rest     int;
begin
  select * into t from public.tournaments where id = p_id for update;
  if not found then
    raise exception 'турнир не найден';
  end if;
  if t.owner_id <> me then
    raise exception 'запускает только создатель';
  end if;
  if t.status <> 'open' then
    raise exception 'турнир уже начался';
  end if;

  select array_agg(user_id order by seed_no) into ids
    from public.tournament_players where tournament_id = p_id;

  if coalesce(array_length(ids, 1), 0) <> t.size then
    raise exception 'нужно ровно % участников', t.size;
  end if;

  -- первый круг: 1-й против последнего, 2-й против предпоследнего
  i := 1;
  while i <= t.size / 2 loop
    a := ids[i];
    b := ids[t.size + 1 - i];
    sd := (floor(random() * 2147483647))::bigint;
    fx := (sd % 2)::int;

    insert into public.matches (mode, seed, rules, status, player1, player2, current_turn)
    values ('tournament', sd,
            jsonb_build_object(
              'first', fx,
              'layout', jsonb_build_object('kind','row','count',5,'fieldRadius',0.93),
              'sakaInFieldPenalty', coalesce((t.rules ->> 'sakaInFieldPenalty')::boolean, true),
              'throwsPerPlayer', coalesce((t.rules ->> 'throwsPerPlayer')::int, 5)
            ),
            'playing', a, b,
            case when fx = 0 then a else b end)
    returning id into mid;

    first := first || jsonb_build_array(
      jsonb_build_object('a', a, 'b', b, 'match', mid, 'winner', null));
    i := i + 1;
  end loop;

  rounds := jsonb_build_array(first);

  -- пустые круги вперёд: заполняются победителями
  rest := t.size / 2;
  while rest > 1 loop
    rest := rest / 2;
    rounds := rounds || jsonb_build_array(
      (select coalesce(jsonb_agg(jsonb_build_object('a', null, 'b', null, 'match', null, 'winner', null)),
                       '[]'::jsonb)
         from generate_series(1, rest)));
  end loop;

  update public.tournaments set bracket = rounds, status = 'running' where id = p_id;
  return rounds;
end;
$$;

-- ── Продвижение победителя ────────────────────────────────────────────────
-- Победителя берём из matches.winner, а не со слов клиента. Когда круг
-- доигран, для следующего заводятся настоящие матчи.
create or replace function public.advance_tournament(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t        public.tournaments;
  rounds   jsonb;
  r        int;
  pair     jsonb;
  j        int;
  mwinner  uuid;
  done     boolean;
  nxt      jsonb;
  k        int;
  a        uuid;
  b        uuid;
  mid      uuid;
  sd       bigint;
  fx       int;
begin
  select * into t from public.tournaments where id = p_id for update;
  if not found then
    raise exception 'турнир не найден';
  end if;
  if t.status <> 'running' then
    return t.bracket;
  end if;

  rounds := t.bracket;

  for r in 0 .. jsonb_array_length(rounds) - 1 loop
    done := true;
    for j in 0 .. jsonb_array_length(rounds -> r) - 1 loop
      pair := rounds -> r -> j;
      if (pair ->> 'winner') is null then
        if (pair ->> 'match') is not null then
          select winner into mwinner from public.matches
           where id = (pair ->> 'match')::uuid and status = 'finished';
          if mwinner is not null then
            rounds := jsonb_set(rounds, array[r::text, j::text, 'winner'], to_jsonb(mwinner));
          else
            done := false;
          end if;
        else
          done := false;
        end if;
      end if;
    end loop;

    exit when not done;

    -- круг доигран: расставляем победителей в следующий и заводим матчи
    if r + 1 < jsonb_array_length(rounds) then
      nxt := rounds -> (r + 1);
      for k in 0 .. jsonb_array_length(nxt) - 1 loop
        a := (rounds -> r -> (k * 2)     ->> 'winner')::uuid;
        b := (rounds -> r -> (k * 2 + 1) ->> 'winner')::uuid;
        if a is not null and b is not null
           and (rounds -> (r + 1) -> k ->> 'match') is null then
          sd := (floor(random() * 2147483647))::bigint;
          fx := (sd % 2)::int;
          insert into public.matches (mode, seed, rules, status, player1, player2, current_turn)
          values ('tournament', sd,
                  jsonb_build_object(
                    'first', fx,
                    'layout', jsonb_build_object('kind','row','count',5,'fieldRadius',0.93),
                    'sakaInFieldPenalty', coalesce((t.rules ->> 'sakaInFieldPenalty')::boolean, true),
                    'throwsPerPlayer', coalesce((t.rules ->> 'throwsPerPlayer')::int, 5)
                  ),
                  'playing', a, b,
                  case when fx = 0 then a else b end)
          returning id into mid;

          rounds := jsonb_set(rounds, array[(r + 1)::text, k::text],
            jsonb_build_object('a', a, 'b', b, 'match', mid, 'winner', null));
        end if;
      end loop;
    else
      update public.tournaments set status = 'finished' where id = p_id;
    end if;
  end loop;

  update public.tournaments set bracket = rounds where id = p_id;
  return rounds;
end;
$$;

-- ── Турнир целиком: сетка и имена участников ──────────────────────────────
create or replace function public.tournament_view(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tournament', to_jsonb(t),
    'players', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', p.id, 'username', p.username, 'seed_no', tp.seed_no)
              order by tp.seed_no)
         from public.tournament_players tp
         join public.profiles p on p.id = tp.user_id
        where tp.tournament_id = t.id),
      '[]'::jsonb)
  )
  from public.tournaments t where t.id = p_id;
$$;

grant execute on function public.create_tournament(text, int, jsonb) to authenticated, anon;
grant execute on function public.join_tournament(uuid)               to authenticated, anon;
grant execute on function public.start_tournament(uuid)              to authenticated, anon;
grant execute on function public.advance_tournament(uuid)            to authenticated, anon;
grant execute on function public.tournament_view(uuid)               to authenticated, anon;
