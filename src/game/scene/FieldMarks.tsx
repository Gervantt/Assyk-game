import type { Field } from '@/physics'
import { toSceneZ } from './coords'

const CHALK = '#f6f1e4'

/** Меловой кон (круг или квадрат) и линия броска. */
export function FieldMarks({ field, throwLineY }: { field: Field; throwLineY: number }) {
  const w = 0.028
  return (
    <group>
      {field.shape === 'circle' ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[field.cx, 0.006, toSceneZ(field.cy)]}>
          <ringGeometry args={[field.radius - w, field.radius + w, 72]} />
          <meshBasicMaterial color={CHALK} transparent opacity={0.82} />
        </mesh>
      ) : (
        <group position={[field.cx, 0.006, toSceneZ(field.cy)]}>
          {[
            [0, field.radius, field.radius * 2, w * 2],
            [0, -field.radius, field.radius * 2, w * 2],
            [field.radius, 0, w * 2, field.radius * 2],
            [-field.radius, 0, w * 2, field.radius * 2],
          ].map(([x, z, sx, sz], i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x!, 0, z!]}>
              <planeGeometry args={[sx!, sz!]} />
              <meshBasicMaterial color={CHALK} transparent opacity={0.82} />
            </mesh>
          ))}
        </group>
      )}

      {/* линия броска */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, toSceneZ(throwLineY)]}>
        <planeGeometry args={[2.9, w * 1.8]} />
        <meshBasicMaterial color={CHALK} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}
