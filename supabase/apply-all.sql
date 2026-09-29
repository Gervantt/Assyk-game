-- ============================================================================
-- Asyq League — вся схема одним файлом.
--
-- СГЕНЕРИРОВАН из supabase/migrations/*.sql — не редактируй его руками,
-- правь миграции и пересобери:  node scripts/build-apply-all.mjs
--
-- Как применить: Supabase -> SQL Editor -> New query -> вставить всё -> Run.
-- Файл идемпотентный: повторный запуск ничего не ломает.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930000100_schema.sql
-- ─────────────────────────────────────────────────────────────────────────

-- Asyq League — схема базы.
-- Применяется первой: таблицы и индексы, без политик доступа.

create extension if not exists pgcrypto;

-- ── Справочник вузов ───────────────────────────────────────────────────────
create table if not exists public.universities (
  id    text primary key,
  name  text not null,
  city  text not null,
  sort  int  not null default 100
);

-- ── Профиль игрока ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null check (char_length(username) between 1 and 24),
  avatar        text not null default 'saka',
  university_id text references public.universities(id) on delete set null,
  locale        text not null default 'kk' check (locale in ('kk','ru','en')),
  rating        int  not null default 1000 check (rating >= 0),
  coins         int  not null default 0 check (coins >= 0),
  -- гость ещё не сохранил прогресс через почту или Google
  is_guest      boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Прогресс кампании ──────────────────────────────────────────────────────
create table if not exists public.progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  level_id    text not null,
  stars       smallint not null check (stars between 1 and 3),
  best_throws int not null check (best_throws > 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, level_id)
);

-- ── История результатов ────────────────────────────────────────────────────
create table if not exists public.results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  mode       text not null check (mode in
                ('training','hotseat','campaign','tutorial','daily','friend','ranked')),
  level_id   text,
  score      int  not null default 0,
  throws     int  not null default 0,
  accuracy   real not null default 0 check (accuracy between 0 and 1),
  stars      smallint check (stars between 1 and 3),
  created_at timestamptz not null default now()
);

-- ── Ежедневное испытание: одна зачётная попытка в день ─────────────────────
create table if not exists public.daily_results (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  score      int  not null default 0,
  throws     int  not null default 0,
  accuracy   real not null default 0 check (accuracy between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ── Пользовательские испытания ─────────────────────────────────────────────
create table if not exists public.custom_levels (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references auth.users(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 60),
  layout     jsonb not null,
  plays      int not null default 0,
  likes      int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Онлайн-матчи (наполняются в Фазе 5) ────────────────────────────────────
create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  mode         text not null check (mode in ('friend','ranked','tournament')),
  seed         bigint not null,
  rules        jsonb not null default '{}'::jsonb,
  status       text not null default 'waiting'
                 check (status in ('waiting','playing','finished','abandoned')),
  player1      uuid not null references auth.users(id) on delete cascade,
  player2      uuid references auth.users(id) on delete set null,
  current_turn uuid references auth.users(id) on delete set null,
  state        jsonb,
  state_hash   text,
  winner       uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.moves (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  player_id   uuid not null references auth.users(id) on delete cascade,
  turn_no     int  not null check (turn_no > 0),
  input       jsonb not null,
  result_hash text not null,
  created_at  timestamptz not null default now(),
  unique (match_id, turn_no)
);

-- ── Покупки (тестовый режим) ───────────────────────────────────────────────
create table if not exists public.purchases (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    text not null,
  test_mode  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

-- ── Частные турниры ────────────────────────────────────────────────────────
create table if not exists public.tournaments (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 60),
  size       int  not null check (size in (4, 8, 16)),
  rules      jsonb not null default '{}'::jsonb,
  bracket    jsonb not null default '[]'::jsonb,
  status     text not null default 'draft'
               check (status in ('draft','open','running','finished')),
  created_at timestamptz not null default now()
);

-- ── Индексы под реальные запросы ───────────────────────────────────────────
create index if not exists results_user_created_idx
  on public.results (user_id, created_at desc);
create index if not exists daily_results_board_idx
  on public.daily_results (date, score desc, throws asc);
create index if not exists progress_user_idx
  on public.progress (user_id);
create index if not exists custom_levels_feed_idx
  on public.custom_levels (likes desc, created_at desc);
create index if not exists matches_player1_idx on public.matches (player1);
create index if not exists matches_player2_idx on public.matches (player2);
create index if not exists moves_match_turn_idx on public.moves (match_id, turn_no);
create index if not exists profiles_university_idx on public.profiles (university_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930000200_rls.sql
-- ─────────────────────────────────────────────────────────────────────────

-- Asyq League — политики доступа.
-- Принцип: писать можно только своё. Читать публично — только то,
-- без чего не работают таблицы лидеров и лента испытаний.

alter table public.universities  enable row level security;
alter table public.profiles      enable row level security;
alter table public.progress      enable row level security;
alter table public.results       enable row level security;
alter table public.daily_results enable row level security;
alter table public.custom_levels enable row level security;
alter table public.matches       enable row level security;
alter table public.moves         enable row level security;
alter table public.purchases     enable row level security;
alter table public.tournaments   enable row level security;

-- ── Вузы: только чтение, наполняются сид-скриптом ──────────────────────────
drop policy if exists universities_read on public.universities;
create policy universities_read on public.universities
  for select using (true);

-- ── Профили: читают все (нужно для таблиц лидеров), пишет только владелец ──
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── Прогресс кампании: строго своё ─────────────────────────────────────────
drop policy if exists progress_own on public.progress;
create policy progress_own on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── История результатов: своё ──────────────────────────────────────────────
drop policy if exists results_read_own on public.results;
create policy results_read_own on public.results
  for select using (auth.uid() = user_id);

drop policy if exists results_insert_own on public.results;
create policy results_insert_own on public.results
  for insert with check (auth.uid() = user_id);

-- ── Ежедневное испытание: читают все (лидерборд), пишет владелец ───────────
drop policy if exists daily_read on public.daily_results;
create policy daily_read on public.daily_results
  for select using (true);

drop policy if exists daily_insert_own on public.daily_results;
create policy daily_insert_own on public.daily_results
  for insert with check (auth.uid() = user_id);
-- UPDATE намеренно не разрешён: зачётная попытка одна на день

-- ── Пользовательские испытания: лента публичная, правит автор ──────────────
drop policy if exists custom_levels_read on public.custom_levels;
create policy custom_levels_read on public.custom_levels
  for select using (true);

drop policy if exists custom_levels_insert_own on public.custom_levels;
create policy custom_levels_insert_own on public.custom_levels
  for insert with check (auth.uid() = author_id);

drop policy if exists custom_levels_modify_own on public.custom_levels;
create policy custom_levels_modify_own on public.custom_levels
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists custom_levels_delete_own on public.custom_levels;
create policy custom_levels_delete_own on public.custom_levels
  for delete using (auth.uid() = author_id);

-- ── Матчи: видят только участники ──────────────────────────────────────────
drop policy if exists matches_read_participant on public.matches;
create policy matches_read_participant on public.matches
  for select using (auth.uid() = player1 or auth.uid() = player2);

drop policy if exists matches_create_own on public.matches;
create policy matches_create_own on public.matches
  for insert with check (auth.uid() = player1);

drop policy if exists matches_update_participant on public.matches;
create policy matches_update_participant on public.matches
  for update using (auth.uid() = player1 or auth.uid() = player2)
  with check (auth.uid() = player1 or auth.uid() = player2);

-- ── Ходы: вставить можно только свой ход и только когда очередь твоя ───────
drop policy if exists moves_read_participant on public.moves;
create policy moves_read_participant on public.moves
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = moves.match_id
        and (auth.uid() = m.player1 or auth.uid() = m.player2)
    )
  );

drop policy if exists moves_insert_on_turn on public.moves;
create policy moves_insert_on_turn on public.moves
  for insert with check (
    auth.uid() = player_id
    and exists (
      select 1 from public.matches m
      where m.id = moves.match_id
        and m.current_turn = auth.uid()
        and m.status = 'playing'
    )
  );
-- Ходы неизменяемы: политик UPDATE и DELETE нет намеренно

-- ── Покупки: только свои ───────────────────────────────────────────────────
drop policy if exists purchases_own on public.purchases;
create policy purchases_own on public.purchases
  for select using (auth.uid() = user_id);

drop policy if exists purchases_insert_own on public.purchases;
create policy purchases_insert_own on public.purchases
  for insert with check (auth.uid() = user_id);

-- ── Турниры: список публичный, правит владелец ─────────────────────────────
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments
  for select using (true);

drop policy if exists tournaments_insert_own on public.tournaments;
create policy tournaments_insert_own on public.tournaments
  for insert with check (auth.uid() = owner_id);

drop policy if exists tournaments_update_own on public.tournaments;
create policy tournaments_update_own on public.tournaments
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ── Права ролей ────────────────────────────────────────────────────────────
-- Supabase выдаёт их и сама через default privileges, но явные grant'ы
-- делают миграцию самодостаточной: её можно применить в любой проект.
grant usage on schema public to anon, authenticated;

grant select on public.universities  to anon, authenticated;
grant select on public.profiles      to anon, authenticated;
grant select on public.daily_results to anon, authenticated;
grant select on public.custom_levels to anon, authenticated;
grant select on public.tournaments   to anon, authenticated;

grant insert, update           on public.profiles      to authenticated;
grant select, insert, update, delete on public.progress to authenticated;
grant select, insert           on public.results       to authenticated;
grant insert                   on public.daily_results to authenticated;
grant insert, update, delete   on public.custom_levels to authenticated;
grant select, insert, update   on public.matches       to authenticated;
grant select, insert           on public.moves         to authenticated;
grant select, insert           on public.purchases     to authenticated;
grant insert, update           on public.tournaments   to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930000300_functions.sql
-- ─────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930000400_universities.sql
-- ─────────────────────────────────────────────────────────────────────────

-- Asyq League — справочник вузов Казахстана.
insert into public.universities (id, name, city, sort) values
  ('narxoz',  'Narxoz University',                                  'Алматы',      1),
  ('kbtu',    'Kazakh-British Technical University',                'Алматы',      2),
  ('sdu',     'SDU University',                                     'Қаскелең',    3),
  ('aitu',    'Astana IT University',                               'Астана',      4),
  ('kaznu',   'Әл-Фараби атындағы ҚазҰУ',                           'Алматы',      5),
  ('enu',     'Л. Гумилев атындағы ЕҰУ',                            'Астана',      6),
  ('nu',      'Nazarbayev University',                              'Астана',      7),
  ('satbayev','Satbayev University',                                'Алматы',      8),
  ('kimep',   'KIMEP University',                                   'Алматы',      9),
  ('kaztu',   'Қ. Жұбанов атындағы АӨУ',                            'Ақтөбе',     10),
  ('buketov', 'Е. Бөкетов атындағы ҚарУ',                           'Қарағанды',  11),
  ('other',   'Басқа / Другой / Other',                             '—',         999)
on conflict (id) do update
  set name = excluded.name, city = excluded.city, sort = excluded.sort;

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930000600_online.sql
-- ─────────────────────────────────────────────────────────────────────────

-- Asyq League — матч с другом по ссылке.
--
-- Почему нужны серверные функции. Политика matches_read_participant пускает
-- только player1 и player2, поэтому приглашённый игрок не может ни прочитать
-- матч, ни вписать себя в него: он ещё не участник. Обе операции вынесены
-- в security definer функции, которые сами проверяют право на действие.

-- ── Вступление в матч по ссылке ────────────────────────────────────────────
create or replace function public.join_match(p_match_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
  first_index int;
begin
  if auth.uid() is null then
    raise exception 'нужен вход';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'матч не найден';
  end if;

  -- создатель открыл собственную ссылку
  if m.player1 = auth.uid() then
    return m;
  end if;

  if m.player2 is not null then
    if m.player2 = auth.uid() then
      return m;
    end if;
    raise exception 'в матче уже двое';
  end if;

  -- кто начинает, решено подбрасыванием при создании и лежит в rules.first
  first_index := coalesce((m.rules ->> 'first')::int, 0);

  update public.matches
     set player2 = auth.uid(),
         status = 'playing',
         current_turn = case when first_index = 0 then m.player1 else auth.uid() end
   where id = p_match_id
  returning * into m;

  return m;
end;
$$;

-- ── Ход ────────────────────────────────────────────────────────────────────
-- Вставка хода и обновление матча одной транзакцией: иначе между ними
-- можно было бы вклиниться и сбить очерёдность.
create or replace function public.submit_move(
  p_match_id    uuid,
  p_turn_no     int,
  p_input       jsonb,
  p_result_hash text,
  p_state       jsonb,
  p_state_hash  text,
  p_next_turn   uuid,
  p_status      text,
  p_winner      uuid
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
begin
  if auth.uid() is null then
    raise exception 'нужен вход';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'матч не найден';
  end if;
  if m.current_turn is distinct from auth.uid() then
    raise exception 'сейчас не ваш ход';
  end if;
  if m.status <> 'playing' then
    raise exception 'матч не идёт';
  end if;

  insert into public.moves (match_id, player_id, turn_no, input, result_hash)
  values (p_match_id, auth.uid(), p_turn_no, p_input, p_result_hash);

  update public.matches
     set state        = p_state,
         state_hash   = p_state_hash,
         current_turn = p_next_turn,
         status       = coalesce(nullif(p_status, ''), m.status),
         winner       = p_winner
   where id = p_match_id
  returning * into m;

  return m;
end;
$$;

-- ── Матч целиком: состояние плюс все ходы ─────────────────────────────────
-- Нужна при перезагрузке страницы: клиент восстанавливается из БД.
create or replace function public.match_snapshot(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.matches;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then
    raise exception 'матч не найден';
  end if;
  if auth.uid() is distinct from m.player1 and auth.uid() is distinct from m.player2 then
    raise exception 'нет доступа к матчу';
  end if;

  return jsonb_build_object(
    'match', to_jsonb(m),
    'moves', coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.turn_no)
         from public.moves x where x.match_id = p_match_id),
      '[]'::jsonb
    ),
    'players', coalesce(
      (select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'avatar', p.avatar))
         from public.profiles p
        where p.id = m.player1 or p.id = m.player2),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.join_match(uuid)                                            to authenticated;
grant execute on function public.submit_move(uuid, int, jsonb, text, jsonb, text, uuid, text, uuid) to authenticated;
grant execute on function public.match_snapshot(uuid)                                        to authenticated;

-- ── Realtime ───────────────────────────────────────────────────────────────
-- Без публикации postgres_changes не приходят.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'moves'
  ) then
    alter publication supabase_realtime add table public.moves;
  end if;
exception
  when undefined_object then
    raise notice 'публикации supabase_realtime нет — вне Supabase это нормально';
end;
$$;
