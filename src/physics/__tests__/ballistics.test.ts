import { describe, expect, it } from 'vitest'
import { PHYSICS, STATE_AIR, STATE_RESTING } from '../config'
import { aimFromAngles, makeThrow } from '../aim'
import { createWorld, DEFAULT_THROW_LINE_Y } from '../world'
import { mechanicalEnergy, peakHeight, simulate } from '../simulate'
import { stepWorld } from '../step'
import { stateHash } from '../hash'
import { surfaceAt, SURFACE_DIRT, SURFACE_SAND } from '../surfaces'
import { heightAt, reliefFor } from '../relief'
import { BODY_SAKA, BODY_STONE, type SimEvent } from '../types'

const ORIGIN = { x: 0, y: DEFAULT_THROW_LINE_Y }
const deg = (d: number) => (d * Math.PI) / 180

function throwAt(degrees: number, power: number, yaw = 0) {
  return makeThrow(aimFromAngles(yaw, deg(degrees), power), ORIGIN)
}

function emptyWorld(surfaceId = SURFACE_SAND) {
  return createWorld({ seed: 7, layout: { kind: 'row', count: 0 }, surfaceId })
}

describe('детерминизм 3D', () => {
  it('1000 прогонов одного броска дают один и тот же хеш', () => {
    const input = throwAt(30, 0.7)
    const expected = stateHash(simulate(emptyWorld(), input).finalState)
    for (let i = 0; i < 1000; i++) {
      expect(stateHash(simulate(emptyWorld(), input).finalState)).toBe(expected)
    }
  })

  it('кадры и события воспроизводятся побайтово', () => {
    const w = () => createWorld({ seed: 7, layout: { kind: 'pyramid', count: 6 } })
    const input = throwAt(22, 0.65)
    const a = simulate(w(), input)
    const b = simulate(w(), input)
    expect(JSON.stringify(a.frames)).toBe(JSON.stringify(b.frames))
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events))
  })
})

/**
 * Восстановление при ударе о землю зависит от того, насколько отвесно
 * пришёлся удар: eGround * (1 + bounceGain * vertical²), не выше eGroundMax.
 * Скользящее касание кость гасит, отвесное падение отбивает живее — без
 * этого навесной бросок не имел смысла ни при каком угле.
 */
function expectedE(surfaceId: number, vertical: number): number {
  const base = surfaceAt(surfaceId).eGround
  const e = base * (1 + PHYSICS.bounceGain * vertical * vertical)
  return e > PHYSICS.eGroundMax ? PHYSICS.eGroundMax : e
}

describe('отскок от земли', () => {
  it('отвесное падение отскакивает по потолку восстановления', () => {
    for (const surfaceId of [SURFACE_SAND, SURFACE_DIRT]) {
      const w = emptyWorld(surfaceId)
      const saka = w.bodies[0]!
      saka.z = 2
      saka.vx = 0
      saka.vy = 0
      saka.vz = -4
      saka.state = STATE_AIR
      const events: SimEvent[] = []
      while (saka.state === STATE_AIR && saka.z > saka.radius) stepWorld(w, events)
      const impact = events.find((x) => x.type === 'groundImpact')
      expect(impact, 'не было касания земли').toBeDefined()
      const impactSpeed = (impact as { speed: number }).speed
      // vertical = 1: горизонтальной скорости нет вовсе
      expect(saka.vz / impactSpeed).toBeCloseTo(expectedE(surfaceId, 1), 6)
    }
  })

  it('скользящее касание отскакивает слабее отвесного', () => {
    const surfaceId = SURFACE_DIRT
    // отношение отскока к удару сразу в момент касания: дальше тело может
    // уйти в скольжение и vz обнулится, так что берём именно первый отскок
    const ratio = (vx: number) => {
      const w = emptyWorld(surfaceId)
      const saka = w.bodies[0]!
      saka.z = 2
      saka.vx = vx
      saka.vz = -6
      saka.state = STATE_AIR
      const events: SimEvent[] = []
      let before = saka.vz
      while (events.every((x) => x.type !== 'groundImpact')) {
        before = saka.vz
        stepWorld(w, events)
      }
      const impact = events.find((x) => x.type === 'groundImpact')! as { speed: number }
      return { e: saka.vz / impact.speed, before }
    }
    const steep = ratio(0)
    const glancing = ratio(9)
    expect(steep.e).toBeGreaterThan(glancing.e)
    // отвесный упирается в потолок, скользящий остаётся около базового
    expect(steep.e).toBeCloseTo(PHYSICS.eGroundMax, 6)
    expect(glancing.e).toBeGreaterThan(surfaceAt(surfaceId).eGround * 0.9)
  })

  it('падение с высоты h даёт подскок примерно на e²·h', () => {
    const surfaceId = SURFACE_DIRT
    const h = 2
    const w = emptyWorld(surfaceId)
    const saka = w.bodies[0]!
    saka.z = h
    saka.state = STATE_AIR

    let peak = 0
    let bounced = false
    const events: SimEvent[] = []
    for (let i = 0; i < PHYSICS.maxTicks; i++) {
      const before = saka.vz
      stepWorld(w, events)
      if (!bounced && before < 0 && saka.vz > 0) bounced = true
      if (bounced) peak = Math.max(peak, saka.z - saka.radius)
      if (bounced && saka.vz < 0 && saka.z - saka.radius < peak) break
    }
    // удар отвесный, значит восстановление упирается в потолок
    const eff = expectedE(surfaceId, 1)
    const ideal = eff * eff * (h - saka.radius)
    // сопротивление воздуха съедает ещё несколько процентов — это ожидаемо
    expect(peak / ideal).toBeGreaterThan(0.85)
    expect(peak / ideal).toBeLessThan(1.0)
  })
})

describe('энергия и целостность', () => {
  it('механическая энергия не растёт', () => {
    const w = createWorld({ seed: 7, layout: { kind: 'pyramid', count: 6 } })
    const input = throwAt(35, 1)
    const sim = createWorld({ seed: 7, layout: { kind: 'pyramid', count: 6 } })
    const saka = sim.bodies[0]!
    saka.vx = input.vx
    saka.vy = input.vy
    saka.vz = input.vz
    saka.state = STATE_AIR

    let previous = mechanicalEnergy(sim) + 1e-6
    const events: SimEvent[] = []
    for (let i = 0; i < 1200; i++) {
      stepWorld(sim, events)
      const now = mechanicalEnergy(sim)
      // допуск покрывает подъём тел при расталкивании перекрытий
      expect(now).toBeLessThanOrEqual(previous + 1e-3)
      previous = Math.max(previous, now) + 1e-9
    }
    expect(w.bodies.length).toBeGreaterThan(0)
  })

  it('на максимальной силе под любым углом тела не проваливаются друг в друга', () => {
    for (let d = 0; d <= 60; d += 10) {
      for (let yawDeg = -30; yawDeg <= 30; yawDeg += 15) {
        const w = createWorld({ seed: 7, layout: { kind: 'pyramid', count: 10 } })
        const input = throwAt(d, 1, deg(yawDeg))
        const saka = w.bodies[0]!
        saka.vx = input.vx
        saka.vy = input.vy
        saka.vz = input.vz
        saka.state = STATE_AIR

        const events: SimEvent[] = []
        for (let i = 0; i < 900; i++) {
          stepWorld(w, events)
          if (i === 899) {
            // К концу все тела обязаны лежать ровно на рельефе: временное
            // погружение допустимо, остаточное — нет.
            const rel = reliefFor(w.seed, w.reliefAmp, w.bounds.halfWidth)
            for (const body of w.bodies) {
              if (body.removed || body.state !== STATE_RESTING) continue
              const floor = heightAt(rel, body.x, body.y) + body.radius
              expect(Math.abs(body.z - floor)).toBeLessThanOrEqual(PHYSICS.quantum * 2)
            }
          }
          for (let a = 0; a < w.bodies.length; a++) {
            const A = w.bodies[a]!
            if (A.removed) continue
            for (let b = a + 1; b < w.bodies.length; b++) {
              const B = w.bodies[b]!
              if (B.removed) continue
              const dx = B.x - A.x
              const dy = B.y - A.y
              const dz = B.z - A.z
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
              const rsum = A.radius + B.radius
              // глубокое проникновение — подпись туннелирования
              expect(dist, `угол ${d}°, рыск ${yawDeg}°`).toBeGreaterThan(rsum * 0.45)
            }
          }
          // Тело не должно проваливаться сквозь землю. Пол не плоский, так
          // что сравниваем с высотой рельефа ПОД телом, а не с радиусом.
          // Допуск — 5% радиуса: в момент столкновения тело на миллиметр
          // погружается и следующим тиком выталкивается, это нормально.
          // Туннелирование выглядело бы совсем иначе — уход на сантиметры.
          const relief = reliefFor(w.seed, w.reliefAmp, w.bounds.halfWidth)
          for (const body of w.bodies) {
            if (body.removed) continue
            const floor = heightAt(relief, body.x, body.y) + body.radius
            expect(body.z, `угол ${d}°, рыск ${yawDeg}°`).toBeGreaterThanOrEqual(
              floor - body.radius * 0.05,
            )
          }
        }
      }
    }
  })

  it('симуляция всегда останавливается в пределах лимита', () => {
    for (let d = 0; d <= 60; d += 5) {
      for (const power of [0, 0.5, 1]) {
        const r = simulate(createWorld({ seed: 7, layout: { kind: 'row', count: 5 } }), throwAt(d, power))
        expect(r.ticks).toBeLessThan(PHYSICS.maxTicks)
        for (const b of r.finalState.bodies) {
          if (b.removed || b.kind === BODY_STONE) continue
          expect(b.state).toBe(STATE_RESTING)
        }
      }
    }
  })
})

describe('профиль броска', () => {
  it('настильный бросок в 5° почти не отрывается от земли', () => {
    const r = simulate(emptyWorld(), throwAt(5, 0.8))
    const peak = peakHeight(r.frames, 0)
    expect(peak - PHYSICS.sakaRadius).toBeLessThan(0.05)
  })

  it('бросок в 50° поднимается и отскакивает хотя бы раз', () => {
    const r = simulate(emptyWorld(), throwAt(50, 0.8))
    expect(peakHeight(r.frames, 0) - PHYSICS.sakaRadius).toBeGreaterThan(0.6)
    expect(r.events.filter((e) => e.type === 'groundImpact').length).toBeGreaterThanOrEqual(1)
  })

  it('чем выше угол, тем выше дуга', () => {
    const heights = [5, 20, 35, 50].map((d) => peakHeight(simulate(emptyWorld(), throwAt(d, 0.7)).frames, 0))
    for (let i = 1; i < heights.length; i++) expect(heights[i]!).toBeGreaterThan(heights[i - 1]!)
  })

  it('на льду сақа уезжает дальше, чем на песке', () => {
    const rest = (surfaceId: number) => {
      const r = simulate(emptyWorld(surfaceId), throwAt(10, 0.5))
      const saka = r.finalState.bodies.find((b) => b.kind === BODY_SAKA)!
      return saka.removed ? Number.POSITIVE_INFINITY : saka.y
    }
    expect(rest(3)).toBeGreaterThan(rest(SURFACE_SAND))
  })
})

describe('очки считаются по покою', () => {
  it('асық, улетевший и вернувшийся в кон, не помечен выбитым', () => {
    const w = createWorld({ seed: 7, layout: { kind: 'row', count: 1, fieldRadius: 2.4 } })
    const asyk = w.bodies[1]!
    // подбрасываем асык вверх и чуть в сторону: он вылетит за круг и вернётся
    asyk.vz = 3.2
    asyk.vx = 0.9
    asyk.state = STATE_AIR
    const events: SimEvent[] = []
    let ticks = 0
    // через функцию, иначе TypeScript сузит тип по присваиванию выше
    // и решит, что stepWorld не может изменить состояние
    const stillMoving = () => (asyk.state as number) !== STATE_RESTING
    while (ticks < PHYSICS.maxTicks && stillMoving()) {
      stepWorld(w, events)
      ticks++
    }
    // событие для эффектов могло случиться, но по покою он внутри
    expect(asyk.outOfField).toBe(false)
  })

  it('асық, остановившийся за кругом, помечен выбитым', () => {
    const r = simulate(createWorld({ seed: 7, layout: { kind: 'row', count: 1 } }), throwAt(8, 0.75))
    const asyk = r.finalState.bodies[1]!
    expect(asyk.outOfField).toBe(true)
  })
})
