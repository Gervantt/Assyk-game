\set ON_ERROR_STOP off
\pset pager off
\pset tuples_only on

-- два пользователя: триггер должен сам создать им профили
insert into auth.users (id, is_anonymous, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', true, '{}'::jsonb),
       ('22222222-2222-2222-2222-222222222222', true, '{"username":"Басқа"}'::jsonb);

select '1. триггер создал профили: ' ||
  (select count(*) from public.profiles where id in
    ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'))::text || ' / 2';
select '   имя из metadata: ' || username from public.profiles
  where id = '22222222-2222-2222-2222-222222222222';
select '   имя гостя по умолчанию: ' || username from public.profiles
  where id = '11111111-1111-1111-1111-111111111111';

-- ── игрок 1 ────────────────────────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select '2. save_progress первый раз: ' ||
  (select (stars::text || ' звёзд, ' || best_throws::text || ' бросков')
   from public.save_progress('aul-1', 2::smallint, 4));

select '   рекорд улучшается: ' ||
  (select (stars::text || ' звёзд, ' || best_throws::text || ' бросков')
   from public.save_progress('aul-1', 3::smallint, 2));

select '   рекорд НЕ ухудшается: ' ||
  (select (stars::text || ' звёзд, ' || best_throws::text || ' бросков')
   from public.save_progress('aul-1', 1::smallint, 9));

select '3. ежедневное, первая попытка засчитана: ' ||
  public.save_daily_result(current_date, 6, 5, 0.8)::text;
select '   вторая попытка отвергнута: ' ||
  public.save_daily_result(current_date, 99, 1, 1.0)::text;
select '   в таблице остался первый результат: ' ||
  (select score::text from public.daily_results where date = current_date
   and user_id = '11111111-1111-1111-1111-111111111111');

insert into public.results (user_id, mode, score, throws, accuracy)
values ('11111111-1111-1111-1111-111111111111', 'training', 4, 5, 0.8);
select '4. своя история видна: ' || (select count(*)::text from public.results);

-- попытка записать чужое
insert into public.progress (user_id, level_id, stars, best_throws)
values ('22222222-2222-2222-2222-222222222222', 'aul-9', 3, 1);
select '5. запись чужого прогресса: строк у чужого = ' ||
  (select count(*)::text from public.progress
   where user_id = '22222222-2222-2222-2222-222222222222');

-- ── игрок 2 ────────────────────────────────────────────────────────────────
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select '6. чужой прогресс не виден: ' || (select count(*)::text from public.progress) || ' строк';
select '   чужая история не видна: ' || (select count(*)::text from public.results) || ' строк';
select '   профили видны всем (для лидеров): ' || (select count(*)::text from public.profiles) || ' строк';
select '   чужой результат дня виден (лидерборд): ' ||
  (select count(*)::text from public.daily_results) || ' строк';

select '7. ежедневное для второго игрока: ' ||
  public.save_daily_result(current_date, 8, 4, 0.9)::text;

reset role;
select '8. таблица лидеров: ' || string_agg(rank::text || '. ' || username || ' — ' || score::text, ' | ')
  from public.daily_leaderboard(current_date, 10);

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select '9. моё место в таблице: ' || public.daily_rank(current_date)::text;
reset role;

select '10. вузы засеяны: ' || (select count(*)::text from public.universities) || ' шт.';
select '11. RLS включён на всех таблицах: ' ||
  (select count(*)::text from pg_tables t
   join pg_class c on c.relname = t.tablename and c.relrowsecurity
   where t.schemaname = 'public') || ' / ' ||
  (select count(*)::text from pg_tables where schemaname = 'public');
