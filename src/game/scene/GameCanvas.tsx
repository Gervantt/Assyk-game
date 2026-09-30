import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import type { WorldState } from '@/physics'
import { Bodies } from './Bodies'
import { CameraRig } from './CameraRig'
import { FieldMarks } from './FieldMarks'
import { Ground } from './Ground'
import { AimIndicator, type PreviewMode } from './AimIndicator'
import { PlaybackDriver } from './PlaybackDriver'
import { useArenaLook } from '@/store/useShopStore'
import { ProjectionBridge } from './ProjectionBridge'
import { SteppeEnvironment } from './SteppeEnvironment'
import { Particles } from '@/game/fx/Particles'
import { Trail } from '@/game/fx/Trail'
import { Decals } from '@/game/fx/Decals'
import { Shockwave } from '@/game/fx/Shockwave'
import { PopupEmitter } from '@/game/fx/Popups'
import { useSettings } from '@/store/useSettings'

/** Сцена 2.5D: камера сверху под углом, тени только от тел. */
export function GameCanvas({
  world,
  children,
  preview = 'short',
}: {
  world: WorldState
  children?: ReactNode
  /** сколько траектории показывать: полную с кольцом, треть или только начало */
  preview?: PreviewMode
}) {
  const level = useSettings((s) => s.effects)
  const rich = level !== 'low'
  const full = level === 'full'
  const arena = useArenaLook()

  return (
    <Canvas
      shadows
      // на уменьшенных эффектах экономим главное — число пикселей
      dpr={full ? [1, 2] : rich ? [1, 1.75] : [1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.86
        // ?perf=1 открывает renderer.info для замеров; в обычной игре не создаётся
        if (new URLSearchParams(location.search).has('perf')) {
          ;(window as unknown as { __asyqGL?: unknown }).__asyqGL = gl
        }
      }}
      camera={{ fov: 42, near: 0.1, far: 60, position: [0, 6.4, 5.5] }}
    >
      {/* двигает часы броска и рассылает события — должен идти первым */}
      <PlaybackDriver world={world} />
      <ProjectionBridge />

      {/* Арена задаёт цвет дымки и солнца. Это оформление: ни дальность
          полёта, ни трение от выбранной арены не меняются. */}
      <fog attach="fog" args={[arena.ground, 16 - arena.haze * 4, 34 - arena.haze * 6]} />

      <hemisphereLight args={[arena.sky, '#2e2212', 0.22]} />
      {/* солнце низко: при высоком солнце тень короче самого асыка и не видна */}
      <directionalLight
        position={[4.6, 3.9, 3.1]}
        color={arena.sun}
        intensity={full ? 2.0 : 2.2}
        castShadow={rich}
        shadow-mapSize={full ? [2048, 2048] : [1024, 1024]}
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
        <SteppeEnvironment />
        <Ground world={world} />
        <FieldMarks field={world.field} throwLineY={world.throwLineY} />
        <Bodies world={world} />
        <AimIndicator world={world} preview={preview} />
        {rich && (
          <>
            <Particles />
            <Trail />
            <Decals />
            <Shockwave />
          </>
        )}
        <PopupEmitter />
        {children}
      </Suspense>
      <CameraRig throwLineY={world.throwLineY} fieldRadius={world.field.radius} />
    </Canvas>
  )
}
