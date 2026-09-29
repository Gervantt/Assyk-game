/**
 * Собирает supabase/apply-all.sql из миграций — файл, который удобно
 * вставить в SQL Editor дашборда одним куском.
 *
 *   node scripts/build-apply-all.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'supabase/migrations'
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

const header = `-- ============================================================================
-- Asyq League — вся схема одним файлом.
--
-- СГЕНЕРИРОВАН из supabase/migrations/*.sql — не редактируй его руками,
-- правь миграции и пересобери:  node scripts/build-apply-all.mjs
--
-- Как применить: Supabase -> SQL Editor -> New query -> вставить всё -> Run.
-- Файл идемпотентный: повторный запуск ничего не ломает.
-- ============================================================================
`

const line = '-- ─────────────────────────────────────────────────────────────────────────'
const body = files
  .map((f) => `\n${line}\n-- ${f}\n${line}\n\n${readFileSync(join(DIR, f), 'utf8')}`)
  .join('')

writeFileSync('supabase/apply-all.sql', `${header}${body}`)
console.log(`apply-all.sql собран из ${files.length} миграций`)
