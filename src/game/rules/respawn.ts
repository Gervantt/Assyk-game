import { BODY_ASYK, PHYSICS, STATE_RESTING, fieldContains, quantize, type WorldState } from '@/physics'

/**
 * Свободное место в кону для асыка, возвращённого по штрафу.
 * Кандидаты перебираются в фиксированном порядке, координаты квантуются —
 * результат детерминирован.
 */
function freeSlot(world: WorldState): { x: number; y: number } {
  const step = PHYSICS.asykRadius * 2.6
  const r = world.field.radius
  for (let ring = 0; ring < 6; ring++) {
    for (let iy = -ring; iy <= ring; iy++) {
      for (let ix = -ring; ix <= ring; ix++) {
        if (ring > 0 && Math.abs(ix) !== ring && Math.abs(iy) !== ring) continue
        const x = quantize(world.field.cx + ix * step)
        const y = quantize(world.field.cy + iy * step)
        if (!fieldContains(world.field, x, y)) continue
        if (Math.abs(x - world.field.cx) > r - PHYSICS.asykRadius) continue
        if (Math.abs(y - world.field.cy) > r - PHYSICS.asykRadius) continue
        const busy = world.bodies.some((b) => {
          if (b.removed || b.outOfField) return false
          const dx = b.x - x
          const dy = b.y - y
          const min = b.radius + PHYSICS.asykRadius
          return dx * dx + dy * dy < min * min
        })
        if (!busy) return { x, y }
      }
    }
  }
  return { x: world.field.cx, y: world.field.cy }
}

/**
 * Штраф по правилу 5: один уже выбитый асық игрока возвращается в кон.
 * Возвращает id асыка или null, если возвращать нечего.
 */
export function returnAsykToField(world: WorldState): number | null {
  const candidates = world.bodies.filter((b) => b.kind === BODY_ASYK && b.scored)
  if (candidates.length === 0) return null
  // самый поздний выбитый — детерминированный выбор по максимальному id
  let pick = candidates[0]!
  for (const c of candidates) if (c.id > pick.id) pick = c
  const slot = freeSlot(world)
  pick.x = slot.x
  pick.y = slot.y
  pick.z = pick.radius
  pick.vx = 0
  pick.vy = 0
  pick.vz = 0
  pick.omega = 0
  pick.state = STATE_RESTING
  pick.outOfField = false
  pick.removed = false
  pick.scored = false
  return pick.id
}
