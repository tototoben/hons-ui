import { useEffect, useRef, useState } from 'react'
import {
  PHOTOBASH_CYCLE_MS,
  PHOTOBASH_FILL_MS,
  mintPhotobashSeed,
  photobashProgress,
} from './photobashLoop'
import {
  isRevealReadyMessage,
  readLastRevealReady,
  WALL_PHASE_CHANNEL,
} from './photobashTrigger'

export type WallPhase = 'intro' | 'prompt' | 'recording' | 'loading'

const CHANNEL = WALL_PHASE_CHANNEL

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

    // Keep conductor state aligned with the zero progress published outside loading.
    if (phase !== 'loading') setLoadingProgress(0)

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
    const fillMs = PHOTOBASH_FILL_MS
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

/** Collage-only loop for the Photobash wall. No intro / prompt / recording. */
export function usePhotobashLoop(isConductor: boolean) {
  const [photobashSeed, setPhotobashSeed] = useState(() => readLastRevealReady()?.photobashSeed ?? 1)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const pendingSeedRef = useRef<number | null>(readLastRevealReady()?.photobashSeed ?? null)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<PhaseMessage | { type: string }>) => {
      if (isRevealReadyMessage(event.data)) {
        if (isConductor) {
          pendingSeedRef.current = event.data.photobashSeed
          setCycleKey((key) => key + 1)
        }
        return
      }
      if (isConductor || event.data?.type !== 'phase') return
      const phase = event.data as PhaseMessage
      if (typeof phase.photobashSeed === 'number') {
        setPhotobashSeed(phase.photobashSeed)
      }
      if (typeof phase.loadingProgress === 'number') {
        setLoadingProgress(phase.loadingProgress)
      }
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [isConductor])

  useEffect(() => {
    if (!isConductor) return
    let cancelled = false
    let raf = 0
    const seed = pendingSeedRef.current ?? mintPhotobashSeed()
    pendingSeedRef.current = null
    const start = performance.now()
    setPhotobashSeed(seed)
    setLoadingProgress(0)
    const publishProgress = (progress: number) => {
      channelRef.current?.postMessage({
        type: 'phase',
        phase: 'loading',
        countdown: null,
        recordSecondsLeft: 0,
        loadingProgress: progress,
        photobashSeed: seed,
      } satisfies PhaseMessage)
    }
    publishProgress(0)
    const tick = () => {
      if (cancelled) return
      const elapsed = performance.now() - start
      const progress = photobashProgress(elapsed)
      setLoadingProgress(progress)
      publishProgress(progress)
      if (elapsed < PHOTOBASH_CYCLE_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const timeout = window.setTimeout(() => {
      if (!cancelled) setCycleKey((key) => key + 1)
    }, PHOTOBASH_CYCLE_MS)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timeout)
    }
  }, [isConductor, cycleKey])

  return { photobashSeed, loadingProgress, cycleKey }
}
