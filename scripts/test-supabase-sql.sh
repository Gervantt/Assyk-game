#!/usr/bin/env bash
# Прогон миграций и проверка политик на временной локальной базе Postgres.
# Supabase для этого не нужен: схема auth эмулируется заглушкой.
#
#   ./scripts/test-supabase-sql.sh
#
# Требуется установленный postgres (initdb, pg_ctl, psql).
set -euo pipefail

PORT=${PGTESTPORT:-54999}
SOCK=$(mktemp -d /tmp/asyqpg.XXXX)
DATA=$(mktemp -d /tmp/asyqdata.XXXX)
cleanup() {
  pg_ctl -D "$DATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$DATA" "$SOCK"
}
trap cleanup EXIT

initdb -D "$DATA" -U postgres --auth=trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$DATA/pg.log" start >/dev/null
sleep 2

run() { psql -h "$SOCK" -p "$PORT" -U postgres "$@"; }

run -qc "create database asyq;" >/dev/null
run -d asyq -v ON_ERROR_STOP=1 -qf supabase/tests/00-auth-stub.sql >/dev/null

echo "== миграции =="
for f in supabase/migrations/*.sql; do
  if run -d asyq -v ON_ERROR_STOP=1 -qf "$f" >/dev/null 2>&1; then
    echo "  OK   $(basename "$f")"
  else
    echo "  FAIL $(basename "$f")"
    run -d asyq -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -20
    exit 1
  fi
done

echo
echo "== политики и функции =="
run -d asyq -f supabase/tests/01-rls.sql 2>&1 |
  grep -vE '^$|^SET$|^RESET$|Pager|INSERT 0' | sed 's/^ //'
