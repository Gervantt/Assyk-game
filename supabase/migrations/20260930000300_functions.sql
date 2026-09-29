-- Asyq League — триггеры и серверные функции.
-- Логика, которую нельзя доверять клиенту: «рекорд только улучшается»
-- и «зачётная попытка в ежедневном испытании ровно одна».
--
-- Функции намеренно security invoker: политики RLS продолжают действовать
-- внутри них. Это опирается на стандартные права Supabase —
-- grant usage on schema auth to authenticated. В чистом Postgres без этого
-- гранта вызов auth.uid() внутри функции упадёт.

-- ── updated_at ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists matches_updated_at on public.matches;
create trigger matches_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

-- ── Профиль создаётся вместе с пользователем ───────────────────────────────
-- Иначе у анонимного игрока не было бы имени, и таблица лидеров
-- показывала бы пустые строки.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, locale, is_guest)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      'Қонақ ' || upper(substr(replace(new.id::text, '-', ''), 1, 4))
    ),
    coalesce(nullif(new.raw_user_meta_data->>'locale', ''), 'kk'),
    new.is_anonymous
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Гость, сохранивший прогресс через почту или Google, перестаёт быть гостем.
create or replace function public.handle_user_upgraded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_anonymous and not new.is_anonymous then
    update public.profiles set is_guest = false where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_upgraded on auth.users;
create trigger on_auth_user_upgraded after update on auth.users
  for each row execute function public.handle_user_upgraded();

-- ── Прогресс кампании: рекорд только улучшается ────────────────────────────
create or replace function public.save_progress(
  p_level_id    text,
  p_stars       smallint,
  p_best_throws int
)
returns public.progress
language plpgsql
security invoker
set search_path = public
as $$
declare
  row public.progress;
begin
  if auth.uid() is null then
    raise exception 'нужен вход';
  end if;

  insert into public.progress (user_id, level_id, stars, best_throws, updated_at)
  values (auth.uid(), p_level_id, p_stars, p_best_throws, now())
  on conflict (user_id, level_id) do update
    set stars = greatest(public.progress.stars, excluded.stars),
        best_throws = least(public.progress.best_throws, excluded.best_throws),
        updated_at = now()
  returning * into row;

  return row;
end;
$$;

-- ── Ежедневное испытание: одна зачётная попытка ────────────────────────────
-- Возвращает true, если результат записан, и false, если игрок
-- уже играл сегодня.
create or replace function public.save_daily_result(
  p_date     date,
  p_score    int,
  p_throws   int,
  p_accuracy real
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'нужен вход';
  end if;

  insert into public.daily_results (user_id, date, score, throws, accuracy)
  values (auth.uid(), p_date, p_score, p_throws, p_accuracy)
  on conflict (user_id, date) do nothing;

  return found;
end;
$$;

-- ── Таблица лидеров дня ────────────────────────────────────────────────────
create or replace function public.daily_leaderboard(p_date date, p_limit int default 50)
returns table (
  user_id     uuid,
  username    text,
  avatar      text,
  university  text,
  score       int,
  throws      int,
  accuracy    real,
  rank        bigint
)
language sql
security definer
set search_path = public
as $$
  select
    d.user_id,
    p.username,
    p.avatar,
    u.name as university,
    d.score,
    d.throws,
    d.accuracy,
    row_number() over (order by d.score desc, d.throws asc, d.created_at asc) as rank
  from public.daily_results d
  join public.profiles p on p.id = d.user_id
  left join public.universities u on u.id = p.university_id
  where d.date = p_date
  order by d.score desc, d.throws asc, d.created_at asc
  limit least(greatest(p_limit, 1), 200);
$$;

-- ── Место игрока в таблице дня ─────────────────────────────────────────────
create or replace function public.daily_rank(p_date date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  my_score  int;
  my_throws int;
begin
  select score, throws into my_score, my_throws
  from public.daily_results
  where user_id = auth.uid() and date = p_date;

  -- сегодня ещё не играл — места нет
  if not found then
    return null;
  end if;

  return (
    select count(*)::int + 1
    from public.daily_results d
    where d.date = p_date
      and (d.score > my_score or (d.score = my_score and d.throws < my_throws))
  );
end;
$$;

grant execute on function public.save_progress(text, smallint, int)        to authenticated;
grant execute on function public.save_daily_result(date, int, int, real)   to authenticated;
grant execute on function public.daily_leaderboard(date, int)              to anon, authenticated;
grant execute on function public.daily_rank(date)                          to authenticated;
