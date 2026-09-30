import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * SPEC: «Все платные предметы визуально одинаковые по физике — в коде физика
 * НЕ читает скин». Проверяем буквально: ни один файл src/physics не
 * упоминает магазин, скины или арены. Пока это так, купленная золотая сақа
 * физически не отличается от обычной — и pay-to-win невозможен по построению.
 */
const BANNED = ['@/shop', 'catalog', 'SakaLook', 'ArenaLook', 'ShopItem', 'skin', 'Skin']

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === '__tests__'
        ? []
        : filesIn(join(dir, e.name))
      : e.name.endsWith('.ts')
        ? [join(dir, e.name)]
        : [],
  )
}

describe('физика не знает о скинах', () => {
  const files = filesIn('src/physics')

  it('в src/physics есть файлы (проверка не вырождена)', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s не упоминает косметику', (file) => {
    const code = readFileSync(file, 'utf8')
    for (const word of BANNED) {
      expect(code).not.toContain(word)
    }
  })

  it('каталог не тянет физику за собой', () => {
    const code = readFileSync('src/shop/catalog.ts', 'utf8')
    expect(code).not.toContain("from '@/physics'")
  })
})
