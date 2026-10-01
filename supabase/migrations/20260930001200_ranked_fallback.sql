-- Asyq League — рейтинг без Edge Function и показ результата обоим игрокам.
--
-- Почему файл появился. Рейтинг считает Edge Function rate-match, но пока она
-- не развёрнута, ELO не начисляется вовсе. Здесь запасной путь прямо в базе.
-- Он ДОВЕРЯЕТ победителю, записанному в матче, то есть слабее функции, которая
-- переигрывает все ходы. Поэтому он включается флагом, и после деплоя функции
-- его надо выключить:
--
--   update public.app_flags set value = false where key = 'ranked_fallback';

create table if not exists public.app_flags (
  key   text primary key,
  value boolean not null
);
alter table public.app_flags enable row level security;  -- без политик: читает только сервер
insert into public.app_flags (key, value) values ('ranked_fallback', true)
on conflict (key) do nothing;

-- Сколько рейтинга получил каждый игрок. Раньше результат возвращался только
-- тому, кто вызвал начисление первым; второй видел «Считаем рейтинг…» вечно.
alter table public.matches
  add column if not exists rating_delta1 int,
  add column if not exists rating_delta2 int;

create or replace function public.apply_ranked_result(p_match_id uuid, p_winner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m    public.matches;
  r1   int;
  r2   int;
  exp1 numeric;
  s1   numeric;
  d1   int;
  k    constant int := 32;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'матч не найден'; end if;
  if m.mode <> 'ranked' then raise exception 'матч не рейтинговый'; end if;
  if m.player2 is null then raise exception 'во втором слоте никого нет'; end if;

  -- уже посчитан: отдаём то, что было начислено, а не пустой ответ
  if m.rated_at is not null then
    select rating into r1 from public.profiles where id = m.player1;
    select rating into r2 from public.profiles where id = m.player2;
    return jsonb_build_object(
      'already', true,
      'player1', m.player1, 'delta1', coalesce(m.rating_delta1, 0), 'rating1', r1,
      'player2', m.player2, 'delta2', coalesce(m.rating_delta2, 0), 'rating2', r2);
  end if;

  select rating into r1 from public.profiles where id = m.player1;
  select rating into r2 from public.profiles where id = m.player2;

  exp1 := 1.0 / (1.0 + power(10.0, (r2 - r1)::numeric / 400.0));
  s1 := case when p_winner is null then 0.5
             when p_winner = m.player1 then 1.0 else 0.0 end;
  d1 := round(k * (s1 - exp1));

  perform set_config('app.privileged', 'on', true);
  update public.profiles set rating = greatest(0, rating + d1) where id = m.player1;
  update public.profiles set rating = greatest(0, rating - d1) where id = m.player2;
  perform set_config('app.privileged', 'off', true);

  update public.matches
     set rated_at = now(), status = 'finished', winner = p_winner,
         rating_delta1 = d1, rating_delta2 = -d1
   where id = p_match_id;

  return jsonb_build_object(
    'already', false,
    'player1', m.player1, 'delta1', d1,  'rating1', greatest(0, r1 + d1),
    'player2', m.player2, 'delta2', -d1, 'rating2', greatest(0, r2 - d1));
end;
$$;
revoke all on function public.apply_ranked_result(uuid, uuid) from public, anon, authenticated;

-- Прочитать результат уже посчитанного матча. Только участникам.
create or replace function public.ranked_result(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m public.matches; r1 int; r2 int;
begin
  select * into m from public.matches where id = p_match_id;
  if not found or (m.player1 <> auth.uid() and m.player2 <> auth.uid()) then
    raise exception 'нет доступа к матчу';
  end if;
  if m.rated_at is null then return null; end if;
  select rating into r1 from public.profiles where id = m.player1;
  select rating into r2 from public.profiles where id = m.player2;
  return jsonb_build_object(
    'already', true,
    'player1', m.player1, 'delta1', coalesce(m.rating_delta1, 0), 'rating1', r1,
    'player2', m.player2, 'delta2', coalesce(m.rating_delta2, 0), 'rating2', r2);
end;
$$;

-- Запасной путь. Победителя берёт из самого матча (его пишет submit_move).
create or replace function public.claim_ranked_result(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare m public.matches;
begin
  if not coalesce((select value from public.app_flags where key = 'ranked_fallback'), false) then
    raise exception 'запасной путь выключен: рейтинг считает Edge Function';
  end if;
  select * into m from public.matches where id = p_match_id;
  if not found or (m.player1 <> auth.uid() and m.player2 <> auth.uid()) then
    raise exception 'нет доступа к матчу';
  end if;
  if m.status <> 'finished' then raise exception 'матч ещё не доигран'; end if;
  return public.apply_ranked_result(p_match_id, m.winner);
end;
$$;

grant execute on function public.ranked_result(uuid)        to authenticated, anon;
grant execute on function public.claim_ranked_result(uuid)  to authenticated, anon;
