#!/usr/bin/env node
/**
 * Копирует src/physics и src/game/rules в supabase/functions/_shared.
 *
 * SPEC требует, чтобы Edge Function переигрывала ходы ТЕМ ЖЕ кодом, что и
 * клиент. Deno не понимает алиас «@/» и требует расширения в импортах,
 * поэтому копия механическая: меняются только пути импортов, ни одна строка
 * логики не переписывается вручную. Расхождение ловит тест shared.test.ts.
 *
 *   node scripts/sync-shared.mjs          — обновить копию
 *   node scripts/sync-shared.mjs --check  — только проверить (код 1 при расхождении)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCES = [
  { from: 'src/physics', to: 'supabase/functions/_shared/physics' },
  { from: 'src/game/rules', to: 'supabase/functions/_shared/rules' },
]

const BANNER = `// СГЕНЕРИРОВАНО scripts/sync-shared.mjs — не править руками.
// Источник: `

/** Импорты Deno: относительные пути с расширением, алиас «@/physics» — на копию. */
function rewrite(code) {
  return code
    .replace(/from '@\/physics'/g, "from '../physics/index.ts'")
    .replace(/from '(\.\.?\/[^']*?)'/g, (m, p) => (p.endsWith('.ts') ? m : `from '${p}.ts'`))
}

export function build() {
  const files = new Map()
  for (const { from, to } of SOURCES) {
    for (const name of readdirSync(join(root, from)).sort()) {
      if (!name.endsWith('.ts')) continue
      const code = readFileSync(join(root, from, name), 'utf8')
      files.set(join(to, name), `${BANNER}${from}/${name}\n${rewrite(code)}`)
    }
  }
  return files
}

const check = process.argv.includes('--check')
const files = build()
let drift = 0

for (const [rel, content] of files) {
  const abs = join(root, rel)
  const current = existsSync(abs) ? readFileSync(abs, 'utf8') : null
  if (current === content) continue
  drift++
  if (check) console.error(`расходится: ${rel}`)
  else {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
}

// лишние файлы в копии — тоже расхождение
for (const { to } of SOURCES) {
  const abs = join(root, to)
  if (!existsSync(abs)) continue
  for (const name of readdirSync(abs)) {
    if (files.has(join(to, name))) continue
    drift++
    if (check) console.error(`лишний файл: ${join(to, name)}`)
    else rmSync(join(abs, name), { recursive: true })
  }
}

if (check && drift) {
  console.error(`\nОбщий код разошёлся (${drift}). Запусти: node scripts/sync-shared.mjs`)
  process.exit(1)
}
if (!check) console.log(`общий код синхронизирован: ${files.size} файлов`)
