import { PHYSICS, STATE_AIR, STATE_RESTING, STATE_SLIDING } from './config'
import { fieldContains } from './field'
import { length } from './math'
import { surfaceAt } from './surfaces'
import { BODY_ASYK, BODY_SAKA, BODY_STONE, type Body, type SimEvent, type WorldState } from './types'

const QUARTER = Math.PI / 2

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
 * Тело легло. Кувыркание прилипает к ближайшей из четырёх сторон —
 * так физически определяется алшы / тәйкі / бүк / шік, включая жеребьёвку.
 * Math.round определён стандартом точно, поэтому детерминизм не страдает.
 */
function comeToRest(b: Body): void {
  b.vx = 0
  b.vy = 0
  b.vz = 0
  b.omega = 0
  b.z = b.radius
  b.state = STATE_RESTING
  const k = Math.round(b.tumble / QUARTER)
  b.tumble = k * QUARTER
  b.side = ((k % 4) + 4) % 4
}

/**
 * Один фиксированный шаг симуляции 1/240 с.
 * Разрешены только + - * / и Math.sqrt — никаких sin/cos/atan/random.
 * Функция мутирует state ради скорости; simulate() работает на копии.
 */
export function stepWorld(state: WorldState, events: SimEvent[]): void {
  const dt = PHYSICS.dt
  const bodies = state.bodies
  const surface = surfaceAt(state.surfaceId)
  state.tick++

  applyMovers(state)

  // ── 1. полёт и скольжение ────────────────────────────────────────────────
  const drag = 1 - PHYSICS.airDrag * dt
  const slideDrop = surface.muSlide * PHYSICS.g * dt
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    if (b.removed || b.kind === BODY_STONE) continue
    if (moverIndex(state, b.id) >= 0) continue
    if (b.state === STATE_RESTING) continue

    if (b.state === STATE_AIR) {
      b.vz = b.vz - PHYSICS.g * dt
      b.vx = b.vx * drag
      b.vy = b.vy * drag
      b.vz = b.vz * drag
    } else {
      // наклон поля действует только на катящееся тело: лежащее держит трение покоя
      b.vx = b.vx + state.windX * dt
      b.vy = b.vy + state.windY * dt
      const sp = length(b.vx, b.vy)
      if (sp - slideDrop <= PHYSICS.vSleep) {
        comeToRest(b)
        continue
      }
      const k = (sp - slideDrop) / sp
      b.vx = b.vx * k
      b.vy = b.vy * k
      // скользящее тело лежит на земле по определению. Удар мог направить
      // его вниз — тогда без этой строки оно уехало бы под поверхность.
      if (b.vz < 0) b.vz = 0
    }

    b.x = b.x + b.vx * dt
    b.y = b.y + b.vy * dt
    b.z = b.z + b.vz * dt
    if (b.state === STATE_SLIDING && b.z < b.radius) b.z = b.radius

    b.tumble = b.tumble + b.omega * dt
    // рыскание — чистый визуал, отсюда «штопор» летящего асыка
    b.yaw = b.yaw + b.omega * dt * 0.37
    const damp = 1 - PHYSICS.omegaDamp * dt
    b.omega = damp > 0 ? b.omega * damp : 0
  }

  // ── 2. удар о землю ──────────────────────────────────────────────────────
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    if (b.removed || b.kind === BODY_STONE || b.state !== STATE_AIR) continue
    if (b.z > b.radius || b.vz >= 0) continue

    const impact = -b.vz
    b.z = b.radius
    b.vz = impact * surface.eGround

    // касание съедает часть горизонтальной скорости
    const vT = length(b.vx, b.vy)
    if (vT > 0) {
      const dvT = surface.mu * (1 + surface.eGround) * impact
      const cap = vT * PHYSICS.maxTangentialLoss
      const lost = dvT < cap ? dvT : cap
      const k = (vT - lost) / vT
      b.vx = b.vx * k
      b.vy = b.vy * k
      // потерянная касательная скорость уходит в кувыркание
      let omega = b.omega + (PHYSICS.tumbleTransfer * lost) / b.radius
      if (omega > PHYSICS.omegaMax) omega = PHYSICS.omegaMax
      if (omega < -PHYSICS.omegaMax) omega = -PHYSICS.omegaMax
      b.omega = omega
    }

    events.push({ type: 'groundImpact', tick: state.tick, bodyId: b.id, speed: impact, x: b.x, y: b.y })

    // подскок стал незаметным — переходим к скольжению
    if (b.vz < PHYSICS.vzSleep) {
      b.vz = 0
      b.state = STATE_SLIDING
    }
  }

  // ── 3. столкновения тел (пары в порядке индексов — порядок детерминирован) ─
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!
    if (a.removed) continue
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!
      if (b.removed) continue
      if (a.state === STATE_RESTING && b.state === STATE_RESTING) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const dz = b.z - a.z
      const rsum = a.radius + b.radius
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 >= rsum * rsum) continue

      release(state, a)
      release(state, b)

      const invA = inverseMass(state, a)
      const invB = inverseMass(state, b)
      const invSum = invA + invB
      if (invSum <= 0) continue

      let nx = 1
      let ny = 0
      let nz = 0
      let dist = 0
      if (d2 > 0) {
        dist = Math.sqrt(d2)
        nx = dx / dist
        ny = dy / dist
        nz = dz / dist
      }

      // расталкивание: только сдвиг позиций, скорости не трогаем,
      // поэтому энергия от этого не растёт
      const overlap = rsum - dist
      a.x = a.x - nx * overlap * (invA / invSum)
      a.y = a.y - ny * overlap * (invA / invSum)
      a.z = a.z - nz * overlap * (invA / invSum)
      b.x = b.x + nx * overlap * (invB / invSum)
      b.y = b.y + ny * overlap * (invB / invSum)
      b.z = b.z + nz * overlap * (invB / invSum)
      if (a.z < a.radius) a.z = a.radius
      if (b.z < b.radius) b.z = b.radius

      const rvx = b.vx - a.vx
      const rvy = b.vy - a.vy
      const rvz = b.vz - a.vz
      const vn = rvx * nx + rvy * ny + rvz * nz
      if (vn >= 0) continue

      const jimp = (-(1 + PHYSICS.eBody) * vn) / invSum
      a.vx = a.vx - jimp * nx * invA
      a.vy = a.vy - jimp * ny * invA
      a.vz = a.vz - jimp * nz * invA
      b.vx = b.vx + jimp * nx * invB
      b.vy = b.vy + jimp * ny * invB
      b.vz = b.vz + jimp * nz * invB

      // касательное трение: гасит проскальзывание, не может добавить скорость
      const tvx = rvx - vn * nx
      const tvy = rvy - vn * ny
      const tvz = rvz - vn * nz
      const tLen = Math.sqrt(tvx * tvx + tvy * tvy + tvz * tvz)
      if (tLen > 0) {
        const maxFriction = PHYSICS.bodyFriction * jimp
        const need = tLen / invSum
        const jt = need < maxFriction ? need : maxFriction
        const ux = tvx / tLen
        const uy = tvy / tLen
        const uz = tvz / tLen
        a.vx = a.vx + jt * ux * invA
        a.vy = a.vy + jt * uy * invA
        a.vz = a.vz + jt * uz * invA
        b.vx = b.vx - jt * ux * invB
        b.vy = b.vy - jt * uy * invB
        b.vz = b.vz - jt * uz * invB
        a.omega = a.omega - (jt * invA) / a.radius
        b.omega = b.omega + (jt * invB) / b.radius
      }

      // удар может подбросить тело — это нормально
      if (a.state !== STATE_AIR && a.vz > 0) a.state = STATE_AIR
      if (b.state !== STATE_AIR && b.vz > 0) b.state = STATE_AIR
      if (a.state === STATE_RESTING) a.state = STATE_SLIDING
      if (b.state === STATE_RESTING) b.state = STATE_SLIDING

      // «Тура!» — попадание по асыку, который был в воздухе
      const target = a.kind === BODY_SAKA ? b : a
      events.push({
        type: 'bodyHit',
        tick: state.tick,
        a: a.id,
        b: b.id,
        impulse: jimp,
        inAir: target.state === STATE_AIR && target.z > target.radius * 1.2,
        x: a.x + nx * a.radius,
        y: a.y + ny * a.radius,
        z: a.z + nz * a.radius,
      })
    }
  }

  // ── 4. границы мира ──────────────────────────────────────────────────────
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
        b.outOfField = true
        b.vx = 0
        b.vy = 0
        b.vz = 0
        b.omega = 0
        b.state = STATE_RESTING
      }
    }
  }

  // ── 5. пересечение границы кона ──────────────────────────────────────────
  // outOfField означает «сейчас центр вне кона». Событие шлём на переходе
  // внутрь -> наружу: оно нужно эффектам. Очки же считаются по покою,
  // поэтому асык, улетевший и вернувшийся, к концу симуляции снова внутри.
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!
    if (b.kind !== BODY_ASYK || b.removed) continue
    const outside = !fieldContains(state.field, b.x, b.y)
    if (outside && !b.outOfField) {
      events.push({ type: 'knockOut', tick: state.tick, bodyId: b.id, x: b.x, y: b.y })
    }
    b.outOfField = outside
  }
}

/**
 * Все тела лежат. Камни неподвижны по определению, а колеблющиеся асыки
 * не считаются: иначе симуляция не завершилась бы никогда.
 */
export function isSettled(state: WorldState): boolean {
  for (let i = 0; i < state.bodies.length; i++) {
    const b = state.bodies[i]!
    if (b.removed || b.kind === BODY_STONE) continue
    if (moverIndex(state, b.id) >= 0) continue
    if (b.state !== STATE_RESTING) return false
  }
  return true
}
