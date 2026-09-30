import { describe, expect, it } from 'vitest'
import { asyksInField, createWorld, DEFAULT_THROW_LINE_Y } from '../world'
import { peakHeight, simulate } from '../simulate'
import { stateHash } from '../hash'
import { aimFromAngles, makeThrow } from '../aim'
import { PHYSICS, STATE_RESTING } from '../config'
import { BODY_SAKA } from '../types'
import { heightAt, reliefFor } from '../relief'

const SEED = 777
const ORIGIN = { x: 0, y: DEFAULT_THROW_LINE_Y }

/** yaw в радианах, угол подъёма в градусах, сила 0..1 */
function shot(yaw: number, elevationDeg: number, power: number) {
  return makeThrow(aimFromAngles(yaw, (elevationDeg * Math.PI) / 180, power), ORIGIN)
}

describe('simulate', () => {
  it('снимок: 20 разных бросков по одному и тому же кону', () => {
    const hashes: string[] = []
    for (let i = 0; i < 20; i++) {
      const w = createWorld({ seed: SEED, layout: { kind: 'pyramid', count: 6 } })
      const yaw = -0.3 + i * 0.03
      const elevation = 6 + (i % 5) * 11
      const r = simulate(w, shot(yaw, elevation, 0.45 + (i % 4) * 0.15))
      hashes.push(`${i}:${stateHash(r.finalState)}:${r.events.length}`)
    }
    expect(hashes).toMatchSnapshot()
  })

  it('симуляция всегда завершается и все тела ложатся', () => {
    for (let i = 0; i < 24; i++) {
      const w = createWorld({ seed: SEED + i, layout: { kind: 'row', count: 5 } })
      const r = simulate(w, shot(-0.35 + i * 0.03, 8 + (i % 6) * 9, 0.7))
      expect(r.ticks).toBeLessThan(PHYSICS.maxTicks)
      for (const b of r.finalState.bodies) {
        if (b.removed || b.kind === 2) continue
        expect(b.state).toBe(STATE_RESTING)
      }
    }
  })

  it('сильный прямой бросок выбивает хотя бы один асық', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 5 } })
    const r = simulate(w, shot(0, 8, 0.8))
    expect(r.events.filter((e) => e.type === 'bodyHit').length).toBeGreaterThan(0)
    expect(asyksInField(r.finalState).length).toBeLessThan(5)
  })

  it('слабый бросок не долетает и никого не выбивает', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 5 } })
    const r = simulate(w, shot(0, 10, 0))
    expect(r.events.filter((e) => e.type === 'bodyHit')).toHaveLength(0)
    expect(asyksInField(r.finalState)).toHaveLength(5)
  })

  it('сақа останавливается в кону — приходит sakaRest с inside', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 0 } })
    let found = false
    for (let i = 0; i < 40 && !found; i++) {
      const r = simulate(w, shot(0, 12, 0.2 + i * 0.005))
      found = r.events.some((e) => e.type === 'sakaRest' && e.inside)
    }
    expect(found).toBe(true)
  })

  it('сақа, ушедшая за пределы мира, даёт sakaLost', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 0 }, boundsHalfHeight: 2 })
    const r = simulate(w, shot(0, 10, 1))
    const saka = r.finalState.bodies.find((b) => b.kind === BODY_SAKA)!
    expect(saka.removed).toBe(true)
    expect(r.events.some((e) => e.type === 'sakaLost')).toBe(true)
  })

  it('упругие стены дают событие wallBounce', () => {
    const w = createWorld({
      seed: SEED,
      layout: { kind: 'row', count: 0 },
      bounceWalls: true,
      boundsHalfWidth: 1.2,
      boundsHalfHeight: 4,
    })
    const r = simulate(w, shot(-0.6, 5, 0.9))
    expect(r.events.some((e) => e.type === 'wallBounce')).toBe(true)
  })

  it('кадры идут монотонно и содержат все тела', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 5 } })
    const r = simulate(w, shot(0.05, 25, 0.7))
    expect(r.frames.length).toBeGreaterThan(2)
    for (let i = 1; i < r.frames.length; i++) {
      expect(r.frames[i]!.tick).toBeGreaterThan(r.frames[i - 1]!.tick)
      expect(r.frames[i]!.bodies).toHaveLength(6)
    }
    expect(r.frames[r.frames.length - 1]!.tick).toBe(r.ticks)
  })

  it('высота в кадрах — настоящая координата, а не рисованная дуга', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 0 } })
    const r = simulate(w, shot(0, 45, 0.8))
    const zs = r.frames.map((f) => f.bodies[0]!.z)
    const last = r.frames[r.frames.length - 1]!.bodies[0]!
    const relief = reliefFor(w.seed, w.reliefAmp, w.bounds.halfWidth)
    // Старт и финиш — на земле, между ними настоящая парабола с отскоками.
    // «На земле» теперь зависит от точки: пол не плоский.
    expect(zs[0]).toBeCloseTo(heightAt(relief, 0, w.throwLineY) + PHYSICS.sakaRadius, 4)
    expect(zs[zs.length - 1]).toBeCloseTo(
      heightAt(relief, last.x, last.y) + PHYSICS.sakaRadius,
      3,
    )
    expect(peakHeight(r.frames, 0)).toBeGreaterThan(0.8)
  })

  it('близкий промах отмечается событием nearMiss', () => {
    const w = createWorld({ seed: SEED, layout: { kind: 'row', count: 1 } })
    let found = false
    for (let i = 0; i < 40 && !found; i++) {
      const r = simulate(w, shot(0.045 + i * 0.002, 8, 0.8))
      const hit = r.events.some((e) => e.type === 'bodyHit')
      found = !hit && r.events.some((e) => e.type === 'nearMiss')
    }
    expect(found).toBe(true)
  })
})
