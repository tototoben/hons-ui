import { useEffect, useState } from 'react'
import { parseCollageCue, type CollageCue } from '../lib/collageCue'
import { centralApiBase } from '../lib/visitCentral'
import type { WallRole } from '../lib/wallRole'
import { WallCollageBlanket } from './WallCollageBlanket'

type ActiveReveal = {
  visitId: string
  seed: number
  cue: CollageCue
  startTime: number
}

export function LiveRevealWall({ role }: { role: WallRole }) {
  const [reveal, setReveal] = useState<ActiveReveal | null>(null)
  useEffect(() => {
    const base = centralApiBase()
    if (!base) return
    let stopped = false
    let timer = 0
    const poll = async () => {
      try {
        const response = await fetch(`${base}/api/wall/reveal`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(2000),
        })
        if (!response.ok) throw new Error('Reveal state unavailable')
        const { reveal: active } = await response.json()
        if (stopped) return
        if (!active || typeof active.visitId !== 'string' ||
            !Number.isFinite(active.seed) || !Number.isFinite(active.elapsedMs)) {
          setReveal(null)
        } else {
          const startTime = performance.now() - Math.max(0, active.elapsedMs)
          setReveal((current) => current?.visitId === active.visitId ? current : {
            visitId: active.visitId,
            seed: active.seed,
            cue: parseCollageCue(active.cue),
            startTime,
          })
        }
      } catch {
        if (!stopped) setReveal(null)
      } finally {
        if (!stopped) timer = window.setTimeout(poll, 750)
      }
    }
    void poll()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [])

  return reveal ? (
    <WallCollageBlanket
      key={reveal.visitId}
      role={role}
      photobashSeed={reveal.seed}
      collageCue={reveal.cue}
      liveReveal={reveal}
    />
  ) : null
}
