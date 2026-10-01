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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930000700_ranked.sql
-- ─────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930000800_league_levels.sql
-- ─────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930000900_shop.sql
-- ─────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930001000_tournaments.sql
-- ─────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930001100_custom_levels_author.sql
-- ─────────────────────────────────────────────────────────────────────────

-- Asyq League — автор пользовательского испытания проставляется сам.
--
-- Политика custom_levels_insert_own проверяет author_id = auth.uid(), но у
-- колонки не было значения по умолчанию. Клиент вставлял только title и
-- layout, author_id уходил пустым, и создание испытания падало с 403.
-- Значение по умолчанию убирает целый класс таких ошибок: забыть про
-- author_id больше нельзя.
alter table public.custom_levels
  alter column author_id set default auth.uid();

-- ─────────────────────────────────────────────────────────────────────────
-- 20260930001200_ranked_fallback.sql
-- ─────────────────────────────────────────────────────────────────────────

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
