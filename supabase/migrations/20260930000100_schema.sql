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
