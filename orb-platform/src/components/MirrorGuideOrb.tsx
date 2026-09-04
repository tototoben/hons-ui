import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { heartbeat } from '../lib/heartbeat'
import { kioskOrbCounts, webGlMaxDpr, getDeviceQuality } from '../lib/deviceQuality'
import { sampleSphere, buildPointGeometry } from '../lib/samplePoints'
import { orbPointVertexShader, orbPointFragmentShader } from '../shaders/pointCloudShaders'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import { base } from '../config'

const DEBRA_LOOP_WEBP = base('/assets/debra-orb.webp')
const DEBRA_LOOP_PNG = base('/assets/debra-orb.png')

const COUNT_POLL_MS = 200

function makeUniforms() {
  const o = mirrorSettings.orb
  return {
    uTime: { value: 0 },
    uIntensity: { value: 1 },
    uHover: { value: 0 },
    uPulse: { value: 0 },
    uActivation: { value: 0 },
    uReducedMotion: { value: getDeviceQuality() === 'kiosk' ? 1 : 0 },
    uPointScale: { value: o.pointScale },
    uRadius: { value: o.radius },
    uAudio: { value: 0 },
    uAudioBass: { value: 0 },
    uAudioMid: { value: 0 },
    uBrightness: { value: o.brightness },
    uAlphaFloor: { value: o.alphaFloor },
    uColorCore: { value: new THREE.Color(o.colorCore) },
    uColorMid: { value: new THREE.Color(o.colorMid) },
    uColorRim: { value: new THREE.Color(o.colorRim) },
  }
}

function readCounts() {
  const o = mirrorSettings.orb
  return kioskOrbCounts({
    shell: o.shellCount,
    volume: o.volumeCount,
    halo: o.haloCount,
  })
}

/**
 * Debra's guide orb on Stations II and III. Plays the recorded transparent
 * loop by default so kiosks stay cheap. Pass `live` to render the WebGL
 * point cloud (used by the capture page).
 */
export function MirrorGuideOrb({
  className,
  live = false,
}: {
  className?: string
  live?: boolean
}) {
  if (!live) {
    return <MirrorGuideOrbLite className={className} />
  }

  return <MirrorGuideOrbCanvas className={className} />
}

/** Transparent APNG/WebP loop. Falls back to a CSS glow if the file is missing. */
function MirrorGuideOrbLite({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div
        className={[className, 'mirror-guide-orb-lite'].filter(Boolean).join(' ')}
        aria-hidden="true"
      />
    )
  }
  return (
    <picture className={[className, 'mirror-guide-orb-loop'].filter(Boolean).join(' ')}>
      <source srcSet={DEBRA_LOOP_WEBP} type="image/webp" />
      <img
        src={DEBRA_LOOP_PNG}
        alt=""
        aria-hidden="true"
        onError={() => setFailed(true)}
      />
    </picture>
  )
}

function MirrorGuideOrbCanvas({ className }: { className?: string }) {
  const [counts, setCounts] = useState(readCounts)
  const kiosk = getDeviceQuality() === 'kiosk'

  useEffect(() => {
    if (!import.meta.env.DEV) return
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last >= COUNT_POLL_MS) {
        last = now
        setCounts((prev) => {
          const next = readCounts()
          return next.shell === prev.shell && next.volume === prev.volume && next.halo === prev.halo
            ? prev
            : next
        })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const geometry = useMemo(() => {
    const data = sampleSphere(1, {
      shellCount: counts.shell,
      volumeCount: counts.volume,
      haloCount: counts.halo,
    })
    return buildPointGeometry(data)
  }, [counts])

  const uniforms = useMemo(makeUniforms, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: orbPointVertexShader,
        fragmentShader: orbPointFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    [uniforms],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return (
    <div className={className}>
      <Canvas
        dpr={[1, webGlMaxDpr()]}
        gl={{
          antialias: !kiosk,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: kiosk ? 'low-power' : 'high-performance',
        }}
        camera={{ fov: 32, near: 0.1, far: 20, position: [0, 0, mirrorSettings.orb.cameraDistance] }}
      >
        <GuideOrbCamera />
        <GuideOrbPoints geometry={geometry} material={material} uniforms={uniforms} />
      </Canvas>
    </div>
  )
}

function GuideOrbCamera() {
  const { camera } = useThree()
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05)
    camera.position.z = THREE.MathUtils.damp(
      camera.position.z,
      mirrorSettings.orb.cameraDistance,
      4,
      d,
    )
  })
  return null
}

function GuideOrbPoints({
  geometry,
  material,
  uniforms,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.ShaderMaterial
  uniforms: ReturnType<typeof makeUniforms>
}) {
  const group = useRef<THREE.Group>(null)
  const scale = useRef(1)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const d = Math.min(delta, 0.05)
    const o = mirrorSettings.orb
    uniforms.uTime.value = t
    uniforms.uPointScale.value = o.pointScale
    uniforms.uRadius.value = o.radius
    uniforms.uBrightness.value = o.brightness
    uniforms.uAlphaFloor.value = o.alphaFloor
    uniforms.uColorCore.value.set(o.colorCore)
    uniforms.uColorMid.value.set(o.colorMid)
    uniforms.uColorRim.value.set(o.colorRim)

    const pulse = heartbeat(t, o.heartbeatBpm) * o.heartbeatRipple
    uniforms.uPulse.value = pulse

    const breath = 1 + Math.sin(t * o.breathSpeed) * o.breathAmplitude
    scale.current = THREE.MathUtils.damp(scale.current, breath, 4, d)
    if (group.current) group.current.scale.setScalar(scale.current)
  })

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}
