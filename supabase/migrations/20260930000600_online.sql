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
