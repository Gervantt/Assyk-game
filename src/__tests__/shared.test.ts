import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

/**
 * SPEC: Edge Function пересчёта рейтинга обязана переигрывать ходы ТЕМ ЖЕ
 * кодом, что и клиент. Копия в supabase/functions/_shared генерируется
 * скриптом; если физику или правила поправили, а копию не обновили — сервер
 * начнёт считать другой результат. Этот тест такое расхождение не пропустит.
 */
describe('общий код клиента и Edge Function', () => {
  it('копия supabase/functions/_shared совпадает с src', () => {
    expect(() =>
      execFileSync('node', ['scripts/sync-shared.mjs', '--check'], { stdio: 'pipe' }),
    ).not.toThrow()
  })
})
