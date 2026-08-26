import { useEffect, useRef, useState } from 'react'

export type WallPhase = 'intro' | 'prompt' | 'recording' | 'loading'

const CHANNEL = 'hons-station3-wall-phase'

/** Fast lead-in, long face reveal — wall install only. */
export const WALL_TIMING = {
  introSeconds: 3,
  promptSeconds: 3,
  countdownStepSeconds: 0.8,
  recordingSeconds: 6,
  /** Hold the blanketed match face this long before looping. */
  loadingSeconds: 65,
} as const

type PhaseMessage = {
  type: 'phase'
  phase: WallPhase
  countdown: number | null
  recordSecondsLeft: number
  loadingProgress: number
  /** Shared RNG seed so every panel draws the same random shards. */
  photobashSeed: number
}

/**
 * Keep all wall-role Chrome windows on the same Station III beat.
 * The Debra panel is the conductor; other roles only listen.
 */
export function useWallSyncedPhase(isConductor: boolean) {
  const [phase, setPhase] = useState<WallPhase>('intro')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordSecondsLeft, setRecordSecondsLeft] = useState<number>(WALL_TIMING.recordingSeconds)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [photobashSeed, setPhotobashSeed] = useState(0)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const loadingSeedRef = useRef<number | null>(null)

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<PhaseMessage>) => {
      if (isConductor || event.data?.type !== 'phase') return
      setPhase(event.data.phase)
      setCountdown(event.data.countdown)
      setRecordSecondsLeft(event.data.recordSecondsLeft)
      setLoadingProgress(event.data.loadingProgress)
      if (typeof event.data.photobashSeed === 'number') {
        setPhotobashSeed(event.data.photobashSeed)
      }
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [isConductor])

  useEffect(() => {
    if (!isConductor) return
    const publish = (next: Omit<PhaseMessage, 'type'>) => {
      channelRef.current?.postMessage({ type: 'phase', ...next } satisfies PhaseMessage)
    }

    const timers: number[] = []
    const t = WALL_TIMING
    const seedFor = (nextPhase: WallPhase) => {
      if (nextPhase !== 'loading') {
        loadingSeedRef.current = null
        return photobashSeed
      }
      if (loadingSeedRef.current === null) {
        loadingSeedRef.current = (Math.random() * 1_000_000_000) | 0
        setPhotobashSeed(loadingSeedRef.current)
      }
      return loadingSeedRef.current
    }

    if (phase === 'intro') {
      publish({
        phase,
        countdown: null,
        recordSecondsLeft,
        loadingProgress: 0,
        photobashSeed: seedFor(phase),
      })
      timers.push(window.setTimeout(() => setPhase('prompt'), t.introSeconds * 1000))
    } else if (phase === 'prompt') {
      setCountdown(null)
      publish({
        phase,
        countdown: null,
        recordSecondsLeft,
        loadingProgress: 0,
        photobashSeed: seedFor(phase),
      })
      timers.push(
        window.setTimeout(() => {
          setCountdown(3)
          publish({
            phase,
            countdown: 3,
            recordSecondsLeft,
            loadingProgress: 0,
            photobashSeed: seedFor(phase),
          })
          timers.push(
            window.setTimeout(() => {
              setCountdown(2)
              publish({
                phase,
                countdown: 2,
                recordSecondsLeft,
                loadingProgress: 0,
                photobashSeed: seedFor(phase),
              })
              timers.push(
                window.setTimeout(() => {
                  setCountdown(1)
                  publish({
                    phase,
                    countdown: 1,
                    recordSecondsLeft,
                    loadingProgress: 0,
                    photobashSeed: seedFor(phase),
                  })
                  timers.push(
                    window.setTimeout(() => {
                      setCountdown(null)
                      setPhase('recording')
                    }, t.countdownStepSeconds * 1000),
                  )
                }, t.countdownStepSeconds * 1000),
              )
            }, t.countdownStepSeconds * 1000),
          )
        }, t.promptSeconds * 1000),
      )
    } else if (phase === 'recording') {
      setRecordSecondsLeft(t.recordingSeconds)
      publish({
        phase,
        countdown: null,
        recordSecondsLeft: t.recordingSeconds,
        loadingProgress: 0,
        photobashSeed: seedFor(phase),
      })
      timers.push(window.setTimeout(() => setPhase('loading'), t.recordingSeconds * 1000))
    } else if (phase === 'loading') {
      setLoadingProgress(0)
      const seed = seedFor(phase)
      publish({
        phase,
        countdown: null,
        recordSecondsLeft: 0,
        loadingProgress: 0,
        photobashSeed: seed,
      })
      timers.push(window.setTimeout(() => setPhase('intro'), t.loadingSeconds * 1000))
    }

    return () => timers.forEach((id) => window.clearTimeout(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConductor, phase])

  useEffect(() => {
    if (!isConductor || phase !== 'recording') return
    const start = performance.now()
    const total = WALL_TIMING.recordingSeconds * 1000
    let raf = 0
    const tick = () => {
      const elapsed = performance.now() - start
      const left = Math.max(0, (total - elapsed) / 1000)
      setRecordSecondsLeft(left)
      channelRef.current?.postMessage({
        type: 'phase',
        phase,
        countdown: null,
        recordSecondsLeft: left,
        loadingProgress: 0,
        photobashSeed,
      } satisfies PhaseMessage)
      if (elapsed < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConductor, phase, photobashSeed])

  useEffect(() => {
    if (!isConductor || phase !== 'loading') return
    // Fill "processing" progress quickly, then hold the face for the rest of loadingSeconds.
    const fillMs = 4000
    const holdMs = WALL_TIMING.loadingSeconds * 1000
    const start = performance.now()
    const seed = loadingSeedRef.current ?? photobashSeed
    let raf = 0
    const tick = () => {
      const elapsed = performance.now() - start
      const progress = Math.min(1, elapsed / fillMs)
      setLoadingProgress(progress)
      channelRef.current?.postMessage({
        type: 'phase',
        phase,
        countdown: null,
        recordSecondsLeft: 0,
        loadingProgress: progress,
        photobashSeed: seed,
      } satisfies PhaseMessage)
      if (elapsed < holdMs) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConductor, phase, photobashSeed])

  return { phase, countdown, recordSecondsLeft, loadingProgress, photobashSeed }
}
