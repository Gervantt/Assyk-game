/**
 * Тряска камеры, пропорциональная импульсу удара.
 * Живёт вне React: добавляется из обработчика событий, читается в useFrame.
 */

let magnitude = 0
let time = 0

const MAX = 0.19
const DECAY = 5.2

export function addShake(amount: number): void {
  magnitude = Math.min(MAX, magnitude + amount)
}

export function resetShake(): void {
  magnitude = 0
}

export interface ShakeOffset {
  x: number
  y: number
}

const offset: ShakeOffset = { x: 0, y: 0 }

/** Текущее смещение камеры. Мутирует и возвращает один и тот же объект. */
export function sampleShake(dt: number): ShakeOffset {
  if (magnitude <= 0.0001) {
    offset.x = 0
    offset.y = 0
    return offset
  }
  time += dt
  magnitude = Math.max(0, magnitude - magnitude * DECAY * dt - 0.0008)
  // две несоизмеримые частоты дают нерегулярное дрожание без шум-текстур
  offset.x = Math.sin(time * 47.3) * magnitude
  offset.y = Math.sin(time * 31.7 + 1.7) * magnitude * 0.72
  return offset
}
