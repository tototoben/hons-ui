import { useThree, useFrame } from '@react-three/fiber'
import { useEffect } from 'react'
import { perfFrame, perfAttachRenderer } from '../lib/perfMonitor'

/**
 * Drop inside any R3F <Canvas> to attach the WebGL renderer
 * for draw call / triangle stats and record frame timings.
 * No-op when perf monitoring is not enabled (?perf=1).
 */
export function PerfMonitorBridge() {
  const { gl } = useThree()

  useEffect(() => {
    perfAttachRenderer(gl as unknown as Parameters<typeof perfAttachRenderer>[0])
  }, [gl])

  useFrame(() => {
    perfFrame()
  })

  return null
}
