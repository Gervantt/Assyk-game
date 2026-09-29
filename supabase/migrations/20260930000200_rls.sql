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
