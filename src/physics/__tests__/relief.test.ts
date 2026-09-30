import { describe, expect, it } from 'vitest'
import { FLAT, heightAt, isFlat, makeRelief, slopeAt } from '../relief'
import { PHYSICS } from '../config'

describe('рельеф земли', () => {
  it('детерминирован по seed', () => {
    const a = makeRelief(12345, 0.012, 4.6)
    const b = makeRelief(12345, 0.012, 4.6)
    expect(Array.from(a.h)).toEqual(Array.from(b.h))
  })

  it('разные seed дают разный рельеф', () => {
    const a = makeRelief(1, 0.012, 4.6)
    const b = makeRelief(2, 0.012, 4.6)
    expect(Array.from(a.h)).not.toEqual(Array.from(b.h))
  })

  it('высоты лежат на сетке квантования', () => {
    const r = makeRelief(7, 0.012, 4.6)
    for (const v of r.h) {
      expect(Math.abs(v / PHYSICS.quantum - Math.round(v / PHYSICS.quantum))).toBeLessThan(1e-6)
    }
  })

  it('амплитуда соблюдается', () => {
    const amp = 0.012
    const r = makeRelief(7, amp, 4.6)
    let peak = 0
    for (const v of r.h) peak = Math.max(peak, Math.abs(v))
    expect(peak).toBeLessThanOrEqual(amp + 1e-9)
    expect(peak).toBeGreaterThan(amp * 0.9)
  })

  it('высота в узле совпадает со значением узла', () => {
    const r = makeRelief(3, 0.02, 4.6)
    const x = r.origin + r.cell * 5
    const y = r.origin + r.cell * 7
    expect(heightAt(r, x, y)).toBeCloseTo(r.h[7 * r.size + 5]!, 12)
  })

  it('за пределами сетки высота берётся с края, а не улетает', () => {
    const r = makeRelief(3, 0.02, 4.6)
    const far = heightAt(r, 999, 999)
    expect(Number.isFinite(far)).toBe(true)
    expect(Math.abs(far)).toBeLessThanOrEqual(0.02 + 1e-9)
  })

  it('уклон направлен в сторону роста высоты', () => {
    const r = makeRelief(5, 0.03, 4.6)
    // ищем точку с заметным уклоном и проверяем знак численно
    for (let x = -3; x < 3; x += 0.37) {
      const s = slopeAt(r, x, 0)
      if (Math.abs(s.dx) < 0.005) continue
      const step = 0.02
      const rise = heightAt(r, x + step, 0) - heightAt(r, x - step, 0)
      expect(Math.sign(rise)).toBe(Math.sign(s.dx))
      return
    }
    throw new Error('не нашлось точки с уклоном — рельеф слишком пологий')
  })

  it('уклон пологий: рельеф уводит, но не работает стеной', () => {
    const r = makeRelief(9, 0.012, 4.6)
    let worst = 0
    for (let x = -4; x <= 4; x += 0.1) {
      for (let y = -4; y <= 4; y += 0.1) {
        const s = slopeAt(r, x, y)
        worst = Math.max(worst, Math.hypot(s.dx, s.dy))
      }
    }
    // больше ~25% уклона тело уже не скользит, а «врезается»
    expect(worst).toBeLessThan(0.25)
    expect(worst).toBeGreaterThan(0.01)
  })

  it('плоский рельеф ровный везде', () => {
    expect(isFlat(FLAT)).toBe(true)
    expect(heightAt(FLAT, 1.3, -2.2)).toBe(0)
    expect(slopeAt(FLAT, 1.3, -2.2)).toEqual({ dx: 0, dy: 0 })
  })
})
