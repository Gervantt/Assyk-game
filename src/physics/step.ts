import { PHYSICS } from './config'
import { fieldContains } from './field'
import { length } from './math'
import { BODY_ASYK, BODY_STONE, type Body, type SimEvent, type WorldState } from './types'

/** Индекс тела с данным id. Тела создаются по порядку, поэтому обычно id === индекс. */
function bodyById(state: WorldState, id: number): Body | undefined {
  const direct = state.bodies[id]
  if (direct && direct.id === id) return direct
  return state.bodies.find((b) => b.id === id)
}

function moverIndex(state: WorldState, id: number): number {
  for (let i = 0; i < state.movers.length; i++) if (state.movers[i]!.bodyId === id) return i
  return -1
}

/**
 * Колеблющиеся асыки. Треугольная волна считается из номера тика:
 * целочисленный остаток и арифметика — значит побитово одинаково везде.
 */
function applyMovers(state: WorldState): void {
  const dt = PHYSICS.dt
  for (const m of state.movers) {
    const b = bodyById(state, m.bodyId)
    if (!b || b.removed) continue
    const phase = (state.tick % m.period) / m.period
    const tri = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4
    const offset = m.amplitude * tri
    const tx = m.axis === 0 ? m.baseX + offset : m.baseX
    const ty = m.axis === 1 ? m.baseY + offset : m.baseY
    // скорость нужна, чтобы столкновение учитывало движение асыка
    b.vx = (tx - b.x) / dt
    b.vy = (ty - b.y) / dt
    b.x = tx
    b.y = ty
  }
}

/** Обратная масса: у камня и у ещё не задетого колеблющегося асыка она нулевая. */
function inverseMass(state: WorldState, b: Body): number {
  if (b.kind === BODY_STONE) return 0
  if (moverIndex(state, b.id) >= 0) return 0
  return 1 / b.mass
}

/** Задетый колеблющийся асық срывается и дальше живёт обычной физикой. */
function release(state: WorldState, b: Body): void {
  const i = moverIndex(state, b.id)
  if (i >= 0) state.movers.splice(i, 1)
}

/**
 * Один фиксированный шаг симуляции 1/120 с.
 * Разрешены только + - * / и Math.sqrt — никаких sin/cos/atan/random.
 * Функция мутирует state ради скорости; simulate() работает на копии.
 */
export function stepWorld(state: WorldState, events: SimEvent[]): void {
  const dt = PHYSICS.dt
  const bodies = state.bodies
  state.tick++

  applyMovers(state)

  // --- 1. ветер, трение качения и интегрирование ---
  const drop = PHYSICS.friction * dt
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    if (b.removed || b.kind === BODY_STONE) continue
    if (moverIndex(state, b.id) >= 0) continue

    const moving = b.vx !== 0 || b.vy !== 0
    if (moving) {
      // наклон поля действует только на катящееся тело: лежащее держит трение покоя
      b.vx = b.vx + state.windX * dt
      b.vy = b.vy + state.windY * dt

      const sp = length(b.vx, b.vy)
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

      // контакт срывает колеблющийся асық с траектории
      release(state, a)
      release(state, b)

      const invA = inverseMass(state, a)
      const invB = inverseMass(state, b)
      const invSum = invA + invB
      if (invSum <= 0) continue

      let nx = 1
      let ny = 0
      let dist = 0
      if (d2 > 0) {
        dist = Math.sqrt(d2)
        nx = dx / dist
        ny = dy / dist
      }

      // расталкивание пропорционально обратной массе
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
    if (b.removed || b.kind === BODY_STONE) continue
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
        release(state, b)
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

/**
 * Все тела остановились или удалены. Камни неподвижны по определению,
 * а колеблющиеся асыки не считаются: иначе симуляция не завершилась бы никогда.
 */
export function isSettled(state: WorldState): boolean {
  for (let i = 0; i < state.bodies.length; i++) {
    const b = state.bodies[i]!
    if (b.removed || b.kind === BODY_STONE) continue
    if (moverIndex(state, b.id) >= 0) continue
    if (b.vx !== 0 || b.vy !== 0) return false
  }
  return true
}
