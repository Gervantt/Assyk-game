import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { normalizeAsyk, proceduralAsyk } from './asykGeometry'

export const ASYK_MODEL_URL = '/models/asyk.glb'

let cached: THREE.BufferGeometry | null = null
let failed = false

/**
 * Геометрия асыка из public/models/asyk.glb. Сақа — тот же меш,
 * отличается только материалом и размером.
 *
 * Модель грузится без Suspense: если файла нет или он битый, игра молча
 * остаётся на примитиве и не показывает белый экран.
 */
export function useAsykModel(): { geometry: THREE.BufferGeometry; fromModel: boolean } {
  const fallback = useMemo(() => proceduralAsyk(), [])
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(cached)

  useEffect(() => {
    if (cached || failed) return
    let cancelled = false
    new GLTFLoader().load(
      ASYK_MODEL_URL,
      (gltf) => {
        if (cancelled) return
        let found: THREE.BufferGeometry | null = null
        gltf.scene.traverse((o) => {
          if (!found && (o as THREE.Mesh).isMesh) found = (o as THREE.Mesh).geometry
        })
        if (!found) {
          failed = true
          return
        }
        cached = normalizeAsyk(found)
        setGeometry(cached)
      },
      undefined,
      () => {
        // модели нет — это не ошибка выполнения, просто работаем на примитиве
        failed = true
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  return { geometry: geometry ?? fallback, fromModel: geometry !== null }
}
