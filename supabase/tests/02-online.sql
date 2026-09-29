\set ON_ERROR_STOP off
\pset pager off
\pset tuples_only on

-- три игрока: двое сыграют, третий попробует влезть
insert into auth.users (id, is_anonymous, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', true, '{"username":"Бірінші"}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', true, '{"username":"Екінші"}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000003', true, '{"username":"Үшінші"}'::jsonb);

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

-- создатель заводит матч; кто ходит первым, решено подбрасыванием (rules.first)
insert into public.matches (id, mode, seed, rules, status, player1)
values ('dddddddd-0000-0000-0000-00000000000f', 'friend', 12345,
        '{"first":0}'::jsonb, 'waiting', 'aaaaaaaa-0000-0000-0000-000000000001');
select '1. матч создан: ' || (select status from public.matches);

-- второй игрок ещё не участник: напрямую матч ему не виден
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select '2. до вступления матч не виден: ' || (select count(*)::text from public.matches) || ' строк';

select '3. join_match: ' ||
  (select status || ', второй = ' || (player2 = 'bbbbbbbb-0000-0000-0000-000000000002')::text ||
          ', ход у первого = ' || (current_turn = 'aaaaaaaa-0000-0000-0000-000000000001')::text
     from public.join_match('dddddddd-0000-0000-0000-00000000000f'));

select '4. после вступления матч виден: ' || (select count(*)::text from public.matches) || ' строк';

-- третий пытается влезть
set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';
select '5. третий вступает (должна быть ошибка):';
select public.join_match('dddddddd-0000-0000-0000-00000000000f');

-- ход не своей очереди
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select '6. ход вне очереди (должна быть ошибка):';
select public.submit_move('dddddddd-0000-0000-0000-00000000000f', 1, '{"vx":1}'::jsonb, 'hash1',
                          '{}'::jsonb, 'state1', 'aaaaaaaa-0000-0000-0000-000000000001', 'playing', null);

-- законный ход первого игрока
set request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
select '7. ход первого игрока: ход переходит второму = ' ||
  (select (current_turn = 'bbbbbbbb-0000-0000-0000-000000000002')::text
     from public.submit_move('dddddddd-0000-0000-0000-00000000000f', 1, '{"vx":1}'::jsonb, 'hash1',
                             '{"tick":1}'::jsonb, 'state1', 'bbbbbbbb-0000-0000-0000-000000000002', 'playing', null));

select '8. повторный ход тем же игроком (должна быть ошибка):';
select public.submit_move('dddddddd-0000-0000-0000-00000000000f', 2, '{"vx":2}'::jsonb, 'hash2',
                          '{}'::jsonb, 'state2', 'bbbbbbbb-0000-0000-0000-000000000002', 'playing', null);

-- ход второго
set request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
select '9. ход второго игрока: ' ||
  (select (current_turn = 'aaaaaaaa-0000-0000-0000-000000000001')::text
     from public.submit_move('dddddddd-0000-0000-0000-00000000000f', 2, '{"vx":2}'::jsonb, 'hash2',
                             '{"tick":2}'::jsonb, 'state2', 'aaaaaaaa-0000-0000-0000-000000000001', 'playing', null));

select '10. ходов записано: ' || (select count(*)::text from public.moves);

-- снимок для восстановления после перезагрузки
select '11. снимок: ходов ' ||
  jsonb_array_length(public.match_snapshot('dddddddd-0000-0000-0000-00000000000f') -> 'moves')::text ||
  ', игроков ' ||
  jsonb_array_length(public.match_snapshot('dddddddd-0000-0000-0000-00000000000f') -> 'players')::text ||
  ', состояние ' ||
  (public.match_snapshot('dddddddd-0000-0000-0000-00000000000f') -> 'match' ->> 'state_hash');

-- посторонний
set request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';
select '12. снимок постороннему (должна быть ошибка):';
select public.match_snapshot('dddddddd-0000-0000-0000-00000000000f');

reset role;
select '13. ходы неизменяемы: политик UPDATE/DELETE на moves — ' ||
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'moves' and cmd in ('UPDATE','DELETE'));
