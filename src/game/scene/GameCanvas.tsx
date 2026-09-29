import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import type { WorldState } from '@/physics'
import { Bodies } from './Bodies'
import { CameraRig } from './CameraRig'
import { FieldMarks } from './FieldMarks'
import { Ground } from './Ground'
import { AimIndicator } from './AimIndicator'

/** Сцена 2.5D: камера сверху под углом, тени только от тел. */
export function GameCanvas({ world, children }: { world: WorldState; children?: ReactNode }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.92
      }}
      camera={{ fov: 42, near: 0.1, far: 60, position: [0, 6.4, 5.5] }}
    >
      <color attach="background" args={['#0d1017']} />
      <fog attach="fog" args={['#0d1017', 11, 21]} />

      <hemisphereLight args={['#cfe0f0', '#3a2c17', 0.32]} />
      <directionalLight
        position={[3.6, 6.8, 3.4]}
        intensity={1.65}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-bias={-0.0002}
        shadow-normalBias={0.015}
      />

      <Suspense fallback={null}>
        <Ground />
        <FieldMarks field={world.field} throwLineY={world.throwLineY} />
        <Bodies world={world} />
        <AimIndicator />
        {children}
      </Suspense>
      <CameraRig />
    </Canvas>
  )
}
