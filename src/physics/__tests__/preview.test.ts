import { describe, expect, it } from 'vitest'
import { aimFromAngles, makeThrow, predictTrajectory } from '../aim'
import { createWorld, DEFAULT_THROW_LINE_Y } from '../world'
import { simulate } from '../simulate'
import { BODY_STONE } from '../types'

const ORIGIN = { x: 0, y: DEFAULT_THROW_LINE_Y }
const shot = (deg: number, power: number) =>
  makeThrow(aimFromAngles(0, (deg * Math.PI) / 180, power), ORIGIN)

const STONE = { x: 0, y: -1.2, radius: 0.3 }

function worldWithStone() {
  return createWorld({ seed: 4, layout: { kind: 'row', count: 0 }, obstacles: [STONE] })
}

function obstaclesOf(world: ReturnType<typeof worldWithStone>) {
  return world.bodies
    .filter((b) => b.kind === BODY_STONE)
    .map((b) => ({ x: b.x, y: b.y, z: b.z, radius: b.radius }))
}

/**
 * Подсказка траектории обязана соглашаться с симуляцией хотя бы в одном:
 * если дуга упирается в камень, сақа в него и попадёт, и наоборот.
 * Расхождение здесь означает, что игрок видит одно, а получает другое.
 */
describe('подсказка и реальность про препятствия', () => {
  it('настильный бросок в камень: дуга обрывается и удар происходит', () => {
    const w = worldWithStone()
    const input = shot(6, 0.8)
    const preview = predictTrajectory(input, w.surfaceId, undefined, 2, obstaclesOf(w))
    expect(preview.blockedAt, 'подсказка не увидела камень').not.toBeNull()

    const r = simulate(w, input)
    const stoneId = w.bodies.find((b) => b.kind === BODY_STONE)!.id
    const hitStone = r.events.some(
      (e) => e.type === 'bodyHit' && (e.a === stoneId || e.b === stoneId),
    )
    expect(hitStone, 'симуляция не попала в камень, хотя подсказка обещала').toBe(true)
  })

  it('дуга обрывается примерно там, где сақа реально встречает камень', () => {
    const w = worldWithStone()
    const input = shot(6, 0.8)
    const preview = predictTrajectory(input, w.surfaceId, undefined, 2, obstaclesOf(w))
    const stop = preview.blockedAt!
    // точка обрыва должна лежать у поверхности камня, а не где-то далеко
    const d = Math.hypot(stop.x - STONE.x, stop.y - STONE.y)
    expect(d).toBeLessThan(STONE.radius + 0.25)
  })

  it('без препятствий дуга не обрывается', () => {
    const w = createWorld({ seed: 4, layout: { kind: 'row', count: 0 } })
    const preview = predictTrajectory(shot(6, 0.8), w.surfaceId, undefined, 2, [])
    expect(preview.blockedAt).toBeNull()
  })

  it('высота камня в подсказке та же, что у коллайдера', () => {
    const w = worldWithStone()
    const stone = w.bodies.find((b) => b.kind === BODY_STONE)!
    const obstacles = obstaclesOf(w)
    // Смысл проверки — подсказка не должна врать про камень. Сравниваем её
    // ровно с коллайдером, а не с радиусом: камень лежит НА рельефе, поэтому
    // его центр стоит на высоте «земля в этой точке + радиус».
    expect(obstacles[0]!.z).toBeCloseTo(stone.z, 6)
    expect(obstacles[0]!.radius).toBeCloseTo(stone.radius, 6)
    // и он действительно приподнят над нулём примерно на радиус
    expect(stone.z).toBeGreaterThan(stone.radius * 0.9)
    expect(stone.z).toBeLessThan(stone.radius * 1.1)
  })
})
