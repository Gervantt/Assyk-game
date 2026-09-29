import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { normalizeAsyk, proceduralAsyk } from './asykGeometry'

export const ASYK_MODEL_URL = '/models/asyk.glb'

interface AsykModel {
  geometry: THREE.BufferGeometry
  map: THREE.Texture | null
}

let cached: AsykModel | null = null
let failed = false

/**
 * Геометрия асыка из public/models/asyk.glb. Сақа — тот же меш,
 * отличается только материалом и размером.
 *
 * Модель грузится без Suspense: если файла нет или он битый, игра молча
 * остаётся на примитиве и не показывает белый экран.
 */
export function useAsykModel(): AsykModel & { fromModel: boolean } {
  const fallback = useMemo(() => ({ geometry: proceduralAsyk(), map: null }), [])
  const [model, setModel] = useState<AsykModel | null>(cached)

  useEffect(() => {
    if (cached || failed) return
    let cancelled = false
    new GLTFLoader().load(
      ASYK_MODEL_URL,
      (gltf) => {
        if (cancelled) return
        gltf.scene.updateMatrixWorld(true)
        const meshes: THREE.Mesh[] = []
        gltf.scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
        })
        const found = meshes[0]
        if (!found) {
          failed = true
          return
        }
        const material = Array.isArray(found.material) ? found.material[0] : found.material
        cached = {
          geometry: normalizeAsyk(found.geometry.clone().applyMatrix4(found.matrixWorld)),
          map: (material as THREE.MeshStandardMaterial).map ?? null,
        }
        setModel(cached)
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

  return { ...(model ?? fallback), fromModel: model !== null }
}
