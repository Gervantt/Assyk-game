\set ON_ERROR_STOP off
\pset pager off
\pset tuples_only on

insert into auth.users (id, is_anonymous, raw_user_meta_data) values
  ('55555555-0000-0000-0000-000000000001', true, '{"username":"Дәулет"}'::jsonb),
  ('66666666-0000-0000-0000-000000000002', true, '{"username":"Мадина"}'::jsonb),
  ('77777777-0000-0000-0000-000000000003', true, '{"username":"Ерлан"}'::jsonb),
  ('88888888-0000-0000-0000-000000000004', true, '{"username":"Аружан"}'::jsonb);

set role authenticated;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000001';

-- ── Магазин ────────────────────────────────────────────────────────────────
select '1. бесплатный скин надевается без покупки: ' ||
  (public.equip_item('saka.red') ->> 'saka');

select '2. платный скин без покупки не надеть:';
select public.equip_item('saka.gold');

select '3. без тиынов не купить:';
select public.buy_item('saka.gold');

-- тиыны начисляет сервер
select '4. начислено тиынов: ' || public.award_coins(50, 'уровень')::text;
select '5. потолок на один вызов (просим 5000): ' || public.award_coins(5000, 'обман')::text;

-- Триггер защиты не пускает даже прямой UPDATE: монеты выдаём так же,
-- как это делает сервер — под флагом app.privileged.
reset role;
do $$
begin
  perform set_config('app.privileged', 'on', true);
  update public.profiles set coins = 600 where id = '55555555-0000-0000-0000-000000000001';
  perform set_config('app.privileged', 'off', true);
end;
$$;
set role authenticated;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000001';

select '6. покупка за тиыны: ' || (public.buy_item('saka.gold') ->> 'coins') || ' тиын осталось';
select '7. теперь надевается: ' || (public.equip_item('saka.gold') ->> 'saka');
select '8. повторная покупка не списывает: ' || (public.buy_item('saka.gold') ->> 'coins');

select '9. тестовая покупка за деньги отмечена test_mode: ' ||
  (public.buy_item('pack.uly-dala') ->> 'test_mode');
select '10. в purchases test_mode = ' ||
  (select test_mode::text from public.purchases
    where user_id = '55555555-0000-0000-0000-000000000001' and item_id = 'pack.uly-dala');

select '11. цены менять из браузера нельзя: ' ||
  case when has_table_privilege('authenticated', 'public.shop_items', 'update')
       then 'МОЖНО — плохо' else 'закрыто' end;

-- ── Турнир ─────────────────────────────────────────────────────────────────
select '12. турнир создан: ' ||
  (select title || ', ' || status || ', мест ' || size::text
     from public.create_tournament('Narxoz Cup', 4, '{"throwsPerPlayer":5}'::jsonb));

set request.jwt.claim.sub = '66666666-0000-0000-0000-000000000002';
select '13. второй вступил: ' ||
  (select status from public.join_tournament((select id from public.tournaments limit 1)));

set request.jwt.claim.sub = '77777777-0000-0000-0000-000000000003';
select (public.join_tournament((select id from public.tournaments limit 1))).status;
set request.jwt.claim.sub = '88888888-0000-0000-0000-000000000004';
select (public.join_tournament((select id from public.tournaments limit 1))).status;

select '14. участников: ' || (select count(*)::text from public.tournament_players);

select '15. запускает не создатель (должна быть ошибка):';
select public.start_tournament((select id from public.tournaments limit 1));

set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000001';
select '16. сетка построена, кругов: ' ||
  jsonb_array_length(public.start_tournament((select id from public.tournaments limit 1)))::text;

reset role;
select '17. матчи первого круга заведены: ' ||
  (select count(*)::text from public.matches where mode = 'tournament');
set role authenticated;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000001';

select '18. пятый игрок не влезет в начавшийся турнир:';
reset role;
insert into auth.users (id, is_anonymous) values ('99999999-0000-0000-0000-000000000005', true);
set role authenticated;
set request.jwt.claim.sub = '99999999-0000-0000-0000-000000000005';
select public.join_tournament((select id from public.tournaments limit 1));

-- доигрываем первый круг: победители — игроки из слота player1
reset role;
update public.matches set status = 'finished', winner = player1 where mode = 'tournament';
set role authenticated;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000001';

select '19. после круга заведён финал: ' ||
  (select jsonb_array_length(public.advance_tournament((select id from public.tournaments limit 1)) -> 1)::text)
  || ' пара(ы)';
reset role;
select '20. всего матчей турнира: ' ||
  (select count(*)::text from public.matches where mode = 'tournament');
set role authenticated;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000001';

reset role;
update public.matches set status = 'finished', winner = player1
 where mode = 'tournament' and winner is null;
set role authenticated;
set request.jwt.claim.sub = '55555555-0000-0000-0000-000000000001';
select jsonb_array_length(public.advance_tournament((select id from public.tournaments limit 1)))::text || ' кругов сыграно';
select '21. турнир завершён: ' || (select status from public.tournaments limit 1);
