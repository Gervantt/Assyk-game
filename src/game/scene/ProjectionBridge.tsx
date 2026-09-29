import { useFrame, useThree } from '@react-three/fiber'
import { setProjectionSource } from './projection'

/** Каждый кадр отдаёт наружу актуальную камеру и размеры холста. */
export function ProjectionBridge() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)

  useFrame(() => {
    const rect = gl.domElement.getBoundingClientRect()
    setProjectionSource(camera, size, { left: rect.left, top: rect.top })
  })

  return null
}
