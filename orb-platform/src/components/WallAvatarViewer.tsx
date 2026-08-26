import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import './WallAvatarViewer.css'

export const WALL_AVATAR_URL = '/assets/wall-avatar/miku.gltf'

function SpinningMiku({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene } = useGLTF(WALL_AVATAR_URL)
  const group = useRef<THREE.Group>(null)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.castShadow = false
        mesh.receiveShadow = false
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const material of materials) {
            material.side = THREE.DoubleSide
          }
        }
      }
    })
    return clone
  }, [scene])

  useFrame((_, delta) => {
    if (reducedMotion || !group.current) return
    group.current.rotation.y += delta * 0.55
  })

  return (
    <group ref={group}>
      <Center>
        <primitive object={model} />
      </Center>
    </group>
  )
}

export function WallAvatarViewer({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <div className="wall-avatar-viewer" aria-label="Generated match avatar">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 28, near: 0.1, far: 200, position: [0, 1.1, 8.5] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#0a0806']} />
        <ambientLight intensity={1.35} />
        <directionalLight position={[4, 6, 3]} intensity={2.2} color="#f4d5dc" />
        <directionalLight position={[-4, 2, 2]} intensity={1.1} color="#8ec5ff" />
        <Suspense fallback={null}>
          <SpinningMiku reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
      <div className="wall-avatar-caption">MATCH ASSEMBLED</div>
    </div>
  )
}

useGLTF.preload(WALL_AVATAR_URL)
