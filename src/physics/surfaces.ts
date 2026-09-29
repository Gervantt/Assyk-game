/**
 * Поверхности кона. Задаются ТОЛЬКО конфигом уровня или режима:
 * купленная арена меняет картинку, но не физику. Поэтому тип поверхности
 * живёт здесь, в движке, и ничего не знает про скины и магазин.
 *
 * О числах muSlide. Исходные значения (0.60 / 0.45 / 0.30 / 0.06 g) при нашей
 * геометрии — линия броска в 3.1 м, кон 1.7 м в поперечнике — превращали кон
 * в болото: сақа после удара проезжала меньше полуметра, и 73% результативных
 * бросков ловили штраф по правилу 5. Замер по сетке из 594 бросков показал,
 * что при 0.24 для песка штраф получают 49% — риск есть, но он перестаёт быть
 * приговором. Порядок поверхностей сохранён, сжат только диапазон.
 */

export interface Surface {
  /** коэффициент восстановления при ударе о землю */
  eGround: number
  /** трение удара: сколько горизонтальной скорости съедает касание земли */
  mu: number
  /** трение скольжения, в долях g */
  muSlide: number
}

export const SURFACES = [
  /** 0 — песок: мягкий, гасит отскок, сильно тормозит. По умолчанию в кампании. */
  { eGround: 0.25, mu: 0.55, muSlide: 0.24 },
  /** 1 — утоптанная земля: эталон. Всегда в рейтинге и онлайне. */
  { eGround: 0.35, mu: 0.45, muSlide: 0.2 },
  /** 2 — асфальт: звонкий отскок, далеко катится. */
  { eGround: 0.5, mu: 0.3, muSlide: 0.14 },
  /** 3 — лёд: почти не тормозит. */
  { eGround: 0.3, mu: 0.08, muSlide: 0.05 },
] as const satisfies readonly Surface[]

export const SURFACE_NAMES = ['sand', 'dirt', 'asphalt', 'ice'] as const
export type SurfaceName = (typeof SURFACE_NAMES)[number]

export const SURFACE_SAND = 0
export const SURFACE_DIRT = 1
export const SURFACE_ASPHALT = 2
export const SURFACE_ICE = 3

export function surfaceByName(name: SurfaceName): number {
  const i = SURFACE_NAMES.indexOf(name)
  return i < 0 ? SURFACE_DIRT : i
}

export function surfaceAt(id: number): Surface {
  return SURFACES[id] ?? SURFACES[SURFACE_DIRT]
}
