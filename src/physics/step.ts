import { PHYSICS } from './config'
import { fieldContains } from './field'
import { length } from './math'
import { BODY_ASYK, type SimEvent, type WorldState } from './types'

/**
 * Один фиксированный шаг симуляции 1/120 с.
 * Разрешены только + - * / и Math.sqrt — никаких sin/cos/atan/random.
 * Функция мутирует state ради скорости; simulate() работает на копии.
 */
export function stepWorld(state: WorldState, events: SimEvent[]): void {
  const dt = PHYSICS.dt
  const bodies = state.bodies
  state.tick++

  // --- 1. трение качения и интегрирование ---
  const drop = PHYSICS.friction * dt
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    if (b.removed) continue
    const sp = length(b.vx, b.vy)
    if (sp > 0) {
      if (sp - drop <= PHYSICS.restEps) {
        b.vx = 0
        b.vy = 0
      } else {
        const k = (sp - drop) / sp
        b.vx = b.vx * k
        b.vy = b.vy * k
        b.x = b.x + b.vx * dt
        b.y = b.y + b.vy * dt
      }
    }
    // визуальное вращение
    b.angle = b.angle + b.spin * dt
    const damp = 1 - PHYSICS.spinDamping * dt
    b.spin = damp > 0 ? b.spin * damp : 0
  }

  // --- 2. столкновения тел (пары в порядке индексов — порядок детерминирован) ---
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!
    if (a.removed) continue
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!
      if (b.removed) continue
      if (a.vx === 0 && a.vy === 0 && b.vx === 0 && b.vy === 0) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const rsum = a.radius + b.radius
      const d2 = dx * dx + dy * dy
      if (d2 >= rsum * rsum) continue

      let nx = 1
      let ny = 0
      let dist = 0
      if (d2 > 0) {
        dist = Math.sqrt(d2)
        nx = dx / dist
        ny = dy / dist
      }

      // расталкивание пропорционально обратной массе
      const invA = 1 / a.mass
      const invB = 1 / b.mass
      const invSum = invA + invB
      const overlap = rsum - dist
      a.x = a.x - nx * overlap * (invA / invSum)
      a.y = a.y - ny * overlap * (invA / invSum)
      b.x = b.x + nx * overlap * (invB / invSum)
      b.y = b.y + ny * overlap * (invB / invSum)

      const rvx = b.vx - a.vx
      const rvy = b.vy - a.vy
      const vn = rvx * nx + rvy * ny
      if (vn >= 0) continue

      const jimp = (-(1 + PHYSICS.restitution) * vn) / invSum
      a.vx = a.vx - jimp * nx * invA
      a.vy = a.vy - jimp * ny * invA
      b.vx = b.vx + jimp * nx * invB
      b.vy = b.vy + jimp * ny * invB

      // касательная составляющая уходит в визуальное вращение
      const vt = rvx * -ny + rvy * nx
      a.spin = a.spin - vt * PHYSICS.spinTransfer * invA
      b.spin = b.spin + vt * PHYSICS.spinTransfer * invB

      events.push({
        type: 'hit',
        tick: state.tick,
        a: a.id,
        b: b.id,
        impulse: jimp,
        x: a.x + nx * a.radius,
        y: a.y + ny * a.radius,
      })
    }
  }

  // --- 3. границы мира ---
  const hw = state.bounds.halfWidth
  const hh = state.bounds.halfHeight
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    if (b.removed) continue
    if (state.bounds.bounce) {
      if (b.x - b.radius < -hw && b.vx < 0) {
        b.x = -hw + b.radius
        b.vx = -b.vx * PHYSICS.wallRestitution
        events.push({ type: 'wallBounce', tick: state.tick, bodyId: b.id, impulse: b.vx })
      } else if (b.x + b.radius > hw && b.vx > 0) {
        b.x = hw - b.radius
        b.vx = -b.vx * PHYSICS.wallRestitution
        events.push({ type: 'wallBounce', tick: state.tick, bodyId: b.id, impulse: b.vx })
      }
      if (b.y - b.radius < -hh && b.vy < 0) {
        b.y = -hh + b.radius
        b.vy = -b.vy * PHYSICS.wallRestitution
        events.push({ type: 'wallBounce', tick: state.tick, bodyId: b.id, impulse: b.vy })
      } else if (b.y + b.radius > hh && b.vy > 0) {
        b.y = hh - b.radius
        b.vy = -b.vy * PHYSICS.wallRestitution
        events.push({ type: 'wallBounce', tick: state.tick, bodyId: b.id, impulse: b.vy })
      }
    } else {
      const ax = b.x < 0 ? -b.x : b.x
      const ay = b.y < 0 ? -b.y : b.y
      if (ax > hw || ay > hh) {
        b.removed = true
        b.vx = 0
        b.vy = 0
        b.spin = 0
      }
    }
  }

  // --- 4. выход за границу кона ---
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    if (b.kind !== BODY_ASYK || b.outOfField) continue
    if (!fieldContains(state.field, b.x, b.y)) {
      b.outOfField = true
      events.push({ type: 'knockOut', tick: state.tick, bodyId: b.id, x: b.x, y: b.y })
    }
  }
}

/** Все тела остановились или удалены. */
export function isSettled(state: WorldState): boolean {
  for (let i = 0; i < state.bodies.length; i++) {
    const b = state.bodies[i]!
    if (b.removed) continue
    if (b.vx !== 0 || b.vy !== 0) return false
  }
  return true
}
