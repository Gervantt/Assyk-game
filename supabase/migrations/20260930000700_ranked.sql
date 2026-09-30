-- Asyq League — Фаза 6: рейтинговые матчи, лига вузов, пользовательские испытания.
--
-- Рейтинг НИКОГДА не начисляется клиентом. Клиент только играет; ELO считает
-- Edge Function rate-match, которая переигрывает все ходы общим кодом
-- (supabase/functions/_shared) и сверяет итог. Поэтому колонка rating закрыта
-- от записи самим игроком — см. политику profiles_write ниже.

-- ── Очередь поиска соперника ───────────────────────────────────────────────
create table if not exists public.queue (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  rating     int  not null default 1000,
  created_at timestamptz not null default now()
);

create index if not exists queue_rating_idx on public.queue (rating, created_at);

grant select on public.queue to anon, authenticated;

alter table public.queue enable row level security;

-- Очередь целиком не видна никому: соперника подбирает функция.
drop policy if exists queue_self on public.queue;
create policy queue_self on public.queue
  for select using (user_id = auth.uid());

-- ── Матч, сыгранный на рейтинг, помечается как посчитанный ────────────────
alter table public.matches
  add column if not exists rated_at timestamptz;

-- ── Постановка в очередь ───────────────────────────────────────────────────
-- Один вызов делает всё: если кто-то уже ждёт — создаём матч и отдаём его id,
-- иначе встаём в очередь сами. Две отдельные операции разъезжались бы:
-- двое могли бы одновременно «никого не найти» и оба сесть ждать.
create or replace function public.enqueue_ranked()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  my_rating int;
  rival    public.queue;
  new_seed bigint;
  first_ix int;
  match_id uuid;
begin
  if me is null then
    raise exception 'нужен вход';
  end if;

  select rating into my_rating from public.profiles where id = me;
  if my_rating is null then
    raise exception 'нет профиля';
  end if;

  -- уже в очереди и соперник нашёлся сам — отдадим его матч
  select id into match_id
    from public.matches
   where mode = 'ranked'
     and status in ('waiting','playing')
     and (player1 = me or player2 = me)
   order by created_at desc
   limit 1;
  if match_id is not null then
    delete from public.queue where user_id = me;
    return match_id;
  end if;

  -- ближайший по рейтингу соперник; строка блокируется, чтобы его
  -- не забрал параллельный вызов
  select * into rival
    from public.queue
   where user_id <> me
   order by abs(rating - my_rating), created_at
   limit 1
     for update skip locked;

  if not found then
    insert into public.queue (user_id, rating)
    values (me, my_rating)
    on conflict (user_id) do update set rating = excluded.rating;
    return null;
  end if;

  delete from public.queue where user_id in (me, rival.user_id);

  new_seed := (floor(random() * 2147483647))::bigint;
  first_ix := (new_seed % 2)::int;

  insert into public.matches (mode, seed, rules, status, player1, player2, current_turn)
  values (
    'ranked',
    new_seed,
    jsonb_build_object(
      'first', first_ix,
      'layout', jsonb_build_object('kind', 'row', 'count', 5),
      'sakaInFieldPenalty', true,
      'throwsPerPlayer', 5
    ),
    'playing',
    rival.user_id,
    me,
    case when first_ix = 0 then rival.user_id else me end
  )
  returning id into match_id;

  return match_id;
end;
$$;

-- ── Выход из очереди ───────────────────────────────────────────────────────
create or replace function public.dequeue_ranked()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.queue where user_id = auth.uid();
$$;

-- ── Проверка «мой матч уже создан?» ───────────────────────────────────────
-- Клиент, стоящий в очереди, опрашивает эту функцию: соперник мог создать
-- матч сам, и никакого Realtime-события на queue при этом не было.
create or replace function public.poll_ranked()
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.matches
   where mode = 'ranked'
     and status in ('waiting','playing')
     and (player1 = auth.uid() or player2 = auth.uid())
   order by created_at desc
   limit 1;
$$;

grant execute on function public.enqueue_ranked() to authenticated, anon;
grant execute on function public.dequeue_ranked() to authenticated, anon;
grant execute on function public.poll_ranked()    to authenticated, anon;

-- ── Защита рейтинга и монет от записи клиентом ─────────────────────────────
-- Политика profiles_update_own разрешает игроку менять свою строку целиком,
-- и до появления рейтинговых матчей это было безобидно. Теперь нет: иначе
-- можно было бы одним UPDATE выставить себе rating = 9999, и вся Фаза 6
-- потеряла бы смысл. Колонки экономики меняют только серверные функции,
-- которые поднимают флаг app.privileged.
create or replace function public.guard_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.privileged', true), 'off') = 'on' then
    return new;
  end if;
  new.rating := old.rating;
  new.coins  := old.coins;
  return new;
end;
$$;

drop trigger if exists profiles_guard_columns on public.profiles;
create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- ── Начисление ELO ─────────────────────────────────────────────────────────
-- Вызывает только Edge Function rate-match, уже переиграв все ходы общим
-- кодом. Функция идемпотентна: matches.rated_at ставится в той же
-- транзакции, повторный вызов ничего не изменит.
create or replace function public.apply_ranked_result(
  p_match_id uuid,
  p_winner   uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m        public.matches;
  r1       int;
  r2       int;
  exp1     numeric;
  s1       numeric;
  d1       int;
  k        constant int := 32;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'матч не найден';
  end if;
  if m.mode <> 'ranked' then
    raise exception 'матч не рейтинговый';
  end if;
  if m.rated_at is not null then
    return jsonb_build_object('already', true);
  end if;
  if m.player2 is null then
    raise exception 'во втором слоте никого нет';
  end if;

  select rating into r1 from public.profiles where id = m.player1;
  select rating into r2 from public.profiles where id = m.player2;

  -- ожидание победы первого: 1 / (1 + 10^((r2 - r1)/400))
  exp1 := 1.0 / (1.0 + power(10.0, (r2 - r1)::numeric / 400.0));
  s1 := case
          when p_winner is null then 0.5
          when p_winner = m.player1 then 1.0
          else 0.0
        end;
  d1 := round(k * (s1 - exp1));

  perform set_config('app.privileged', 'on', true);
  update public.profiles set rating = greatest(0, rating + d1)  where id = m.player1;
  update public.profiles set rating = greatest(0, rating - d1)  where id = m.player2;
  perform set_config('app.privileged', 'off', true);

  update public.matches
     set rated_at = now(),
         status = 'finished',
         winner = p_winner
   where id = p_match_id;

  return jsonb_build_object(
    'already', false,
    'player1', m.player1, 'delta1', d1, 'rating1', greatest(0, r1 + d1),
    'player2', m.player2, 'delta2', -d1, 'rating2', greatest(0, r2 - d1)
  );
end;
$$;

-- Postgres по умолчанию выдаёт EXECUTE роли public, поэтому снимать надо
-- именно с неё: revoke у authenticated оставил бы функцию открытой, и любой
-- игрок начислил бы себе победу одним вызовом, не сыграв матча.
revoke all on function public.apply_ranked_result(uuid, uuid) from public, anon, authenticated;

-- ── Данные для пересчёта: матч со всеми ходами ─────────────────────────────
create or replace function public.match_for_rating(p_match_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'match', to_jsonb(m) - 'state',
    'moves', coalesce(
      (select jsonb_agg(to_jsonb(mv) order by mv.turn_no)
         from public.moves mv where mv.match_id = m.id),
      '[]'::jsonb)
  )
  from public.matches m
  where m.id = p_match_id;
$$;

revoke all on function public.match_for_rating(uuid) from public, anon, authenticated;
