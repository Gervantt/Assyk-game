\set ON_ERROR_STOP off
\pset pager off
\pset tuples_only on

-- ── Подготовка: два студента одного вуза и один чужого ─────────────────────
insert into auth.users (id, is_anonymous, raw_user_meta_data) values
  ('11111111-0000-0000-0000-000000000001', true, '{"username":"Айдос"}'::jsonb),
  ('22222222-0000-0000-0000-000000000002', true, '{"username":"Бота"}'::jsonb),
  ('33333333-0000-0000-0000-000000000003', true, '{"username":"Сая"}'::jsonb);

insert into public.universities (id, name, city, sort) values
  ('narxoz', 'Narxoz', 'Алматы', 1),
  ('kbtu',   'KBTU',   'Алматы', 2)
on conflict (id) do nothing;

update public.profiles set university_id = 'narxoz'
  where id in ('11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002');
update public.profiles set university_id = 'kbtu'
  where id = '33333333-0000-0000-0000-000000000003';

-- ── Рейтинг защищён от записи клиентом ─────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';

update public.profiles set rating = 9999, coins = 9999
  where id = '11111111-0000-0000-0000-000000000001';
select '1. игрок не может накрутить рейтинг и монеты: rating=' ||
  (select rating::text from public.profiles where id = '11111111-0000-0000-0000-000000000001') ||
  ', coins=' ||
  (select coins::text from public.profiles where id = '11111111-0000-0000-0000-000000000001');

-- имя менять по-прежнему можно
update public.profiles set username = 'Айдос Ж.'
  where id = '11111111-0000-0000-0000-000000000001';
select '2. имя менять можно: ' ||
  (select username from public.profiles where id = '11111111-0000-0000-0000-000000000001');

-- ── Очередь: первый ждёт, второй находит соперника ─────────────────────────
select '3. первый встал в очередь, матча нет: ' ||
  coalesce((select public.enqueue_ranked())::text, 'null');

set request.jwt.claim.sub = '22222222-0000-0000-0000-000000000002';
select '4. второй сразу получил матч: ' ||
  (select (public.enqueue_ranked() is not null)::text);

select '5. очередь опустела: ' || (select count(*)::text from public.queue) || ' строк';

select '6. матч рейтинговый и в игре: ' ||
  (select mode || ', ' || status || ', ход назначен = ' || (current_turn is not null)::text
     from public.matches where mode = 'ranked' limit 1);

-- первый игрок тоже видит свой матч
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
select '7. poll_ranked находит матч первому: ' ||
  (select (public.poll_ranked() is not null)::text);

-- ── ELO начисляет только сервер ────────────────────────────────────────────
select '8. apply_ranked_result недоступна игроку: ' ||
  case when has_function_privilege('authenticated',
         'public.apply_ranked_result(uuid,uuid)', 'execute')
       then 'ДОСТУПНА — плохо' else 'закрыта' end;

select '9. match_for_rating недоступна игроку: ' ||
  case when has_function_privilege('authenticated',
         'public.match_for_rating(uuid)', 'execute')
       then 'ДОСТУПНА — плохо' else 'закрыта' end;

reset role;
do $$
declare
  mid uuid;
  res jsonb;
begin
  select id into mid from public.matches where mode = 'ranked' limit 1;
  res := public.apply_ranked_result(mid, '11111111-0000-0000-0000-000000000001');
  raise notice '10. ELO начислен: победитель % (%), проигравший %',
    res ->> 'delta1', res ->> 'rating1', res ->> 'delta2';
  res := public.apply_ranked_result(mid, '11111111-0000-0000-0000-000000000001');
  raise notice '11. повторный пересчёт ничего не меняет: already=%', res ->> 'already';
end;
$$;

select '12. рейтинги после матча: ' ||
  string_agg(username || '=' || rating::text, ', ' order by username)
  from public.profiles where university_id is not null;

-- ── Лига вузов ─────────────────────────────────────────────────────────────
insert into public.daily_results (user_id, date, score, throws, accuracy) values
  ('11111111-0000-0000-0000-000000000001', current_date, 4, 5, 0.8),
  ('22222222-0000-0000-0000-000000000002', current_date, 3, 5, 0.6),
  ('33333333-0000-0000-0000-000000000003', current_date, 5, 5, 1.0)
on conflict do nothing;

select '13. лига: ' || string_agg(name || '=' || points::text, ', ' order by points desc)
  from public.university_league(null) where points > 0;

-- ── Пользовательские испытания ─────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';

insert into public.custom_levels (id, author_id, title, layout)
values ('44444444-0000-0000-0000-000000000004',
        '11111111-0000-0000-0000-000000000001',
        'Тар өткел',
        '{"v":1,"asyks":[{"x":0,"y":0}],"shape":"circle","fieldRadius":0.9,"throws":3,"goal":0,"penalty":true,"surface":"sand"}'::jsonb);

select '14. испытание видно другому игроку: ' ||
  (select count(*)::text from public.custom_levels);

set request.jwt.claim.sub = '33333333-0000-0000-0000-000000000003';
select '15. чужое испытание читается по ссылке: ' ||
  (select count(*)::text from public.custom_levels
    where id = '44444444-0000-0000-0000-000000000004');

select '16. лайк: ' || public.like_custom_level('44444444-0000-0000-0000-000000000004')::text;
select '17. повторный лайк снимает: ' ||
  public.like_custom_level('44444444-0000-0000-0000-000000000004')::text;

with attempt as (
  delete from public.custom_levels
   where id = '44444444-0000-0000-0000-000000000004'
  returning 1
)
select '18. чужое испытание не удалить: удалено строк ' ||
  (select count(*)::text from attempt);

select public.bump_custom_plays('44444444-0000-0000-0000-000000000004');

select '19. лента отдаёт автора: ' ||
  (select author || ', лайков ' || likes::text
     from public.list_custom_levels('popular', 10) limit 1);

-- Путь клиента: вставка БЕЗ author_id. Раньше так падало с 403.
set request.jwt.claim.sub = '11111111-0000-0000-0000-000000000001';
insert into public.custom_levels (title, layout)
values ('Кон дөңгелек',
        '{"v":1,"asyks":[{"x":0.1,"y":0}],"shape":"square","fieldRadius":1.0,"throws":2,"goal":1,"penalty":false,"surface":"dirt"}'::jsonb);
select '19a. вставка без author_id проходит, автор проставлен сам: ' ||
  (select (author_id = '11111111-0000-0000-0000-000000000001')::text
     from public.custom_levels where title = 'Кон дөңгелек');

select '20. счётчик игр растёт: ' ||
  (select plays::text from public.custom_levels
    where id = '44444444-0000-0000-0000-000000000004');
