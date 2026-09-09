import { useEffect, useRef, useState } from 'react'
import {
  PHOTOBASH_CYCLE_MS,
  PHOTOBASH_FILL_MS,
  mintPhotobashSeed,
  photobashProgress,
} from './photobashLoop'
import {
  collageCueFromLocalAnswers,
  collageCueFromVisitCentral,
  parseCollageCue,
  type CollageCue,
} from './collageCue'
import { peekActiveVisits, refreshVisitCache } from './visitCentral'
import {
  completeActivePhotowallJob,
  isRevealReadyMessage,
  readLastRevealReady,
  WALL_PHASE_CHANNEL,
} from './photobashTrigger'

export type WallPhase = 'intro' | 'prompt' | 'recording' | 'loading' | 'handoff'

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
  collageCue?: CollageCue
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
  const [collageCue, setCollageCue] = useState<CollageCue>({})
  const channelRef = useRef<BroadcastChannel | null>(null)
  const loadingSeedRef = useRef<number | null>(null)
  const loadingCueRef = useRef<CollageCue | null>(null)

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
      if (event.data.collageCue) {
        setCollageCue(parseCollageCue(event.data.collageCue))
      }
    }
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [isConductor])

  useEffect(() => {
    if (!isConductor) return
    const publish = (next: Omit<PhaseMessage, 'type' | 'collageCue'> & { collageCue?: CollageCue }) => {
      channelRef.current?.postMessage({
        type: 'phase',
        collageCue: cueFor(),
        ...next,
      } satisfies PhaseMessage)
    }

    const timers: number[] = []
    const t = WALL_TIMING
    const seedFor = (nextPhase: WallPhase) => {
      if (nextPhase !== 'loading') {
        loadingSeedRef.current = null
        loadingCueRef.current = null
        return photobashSeed
      }
      if (loadingSeedRef.current === null) {
        loadingSeedRef.current = (Math.random() * 1_000_000_000) | 0
        setPhotobashSeed(loadingSeedRef.current)
      }
      if (loadingCueRef.current === null) {
        loadingCueRef.current = collageCueFromLocalAnswers()
        setCollageCue(loadingCueRef.current)
      }
      return loadingSeedRef.current
    }
    const cueFor = () => loadingCueRef.current ?? collageCue

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
        collageCue,
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
        collageCue: loadingCueRef.current ?? collageCue,
      } satisfies PhaseMessage)
      if (elapsed < holdMs) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConductor, phase, photobashSeed])

  return { phase, countdown, recordSecondsLeft, loadingProgress, photobashSeed, collageCue }
}

/** Collage-only loop for the Photobash wall. No intro / prompt / recording. */
export function usePhotobashLoop(isConductor: boolean) {
  const lastReveal = readLastRevealReady()
  const [photobashSeed, setPhotobashSeed] = useState(() => lastReveal?.photobashSeed ?? 1)
  const [collageCue, setCollageCue] = useState<CollageCue>(
    () => lastReveal?.collageCue ?? collageCueFromLocalAnswers(),
  )
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [cycleKey, setCycleKey] = useState(0)
  // No visitor has finished Station 3 yet in this browser session -- stay
  // blank rather than mint an ambient random collage with nobody there.
  const [hasRevealed, setHasRevealed] = useState(() => lastReveal !== null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const pendingSeedRef = useRef<number | null>(lastReveal?.photobashSeed ?? null)
  const pendingCueRef = useRef<CollageCue | null>(lastReveal?.collageCue ?? null)
  const activeJobIdRef = useRef<string | null>(lastReveal?.jobId ?? null)

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<PhaseMessage | { type: string }>) => {
      if (isRevealReadyMessage(event.data)) {
        setHasRevealed(true)
        if (isConductor) {
          pendingSeedRef.current = event.data.photobashSeed
          pendingCueRef.current = parseCollageCue(event.data.collageCue)
          activeJobIdRef.current = event.data.jobId ?? null
          setCycleKey((key) => key + 1)
        }
        return
      }
      if (isConductor || event.data?.type !== 'phase') return
      const phase = event.data as PhaseMessage
      // A real 'phase' broadcast only ever comes from the conductor once it
      // has an actual reveal to show -- listeners never get a typed
      // 'reveal-ready' message of their own (that only ever originates on
      // Station 3's machine), so this is their only signal to stop staying
      // blank. Without this, every non-conductor wall panel stays blank
      // forever even while the conductor is correctly cycling.
      setHasRevealed(true)
      if (typeof phase.photobashSeed === 'number') {
        setPhotobashSeed(phase.photobashSeed)
      }
      if (phase.collageCue) {
        setCollageCue(parseCollageCue(phase.collageCue))
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

  // Cross-machine bridge: Station 3's kiosk and this wall are different
  // physical devices, so its BroadcastChannel/localStorage reveal-ready
  // signal (above) never reaches here directly -- only Central's HTTP API
  // does. Poll it for a visit that has reached the 'reveal' state and
  // isn't one we've already started a cycle for.
  useEffect(() => {
    if (!isConductor) return
    let cancelled = false
    const seenVisitIds = new Set<string>()
    const poll = async () => {
      if (cancelled) return
      await refreshVisitCache(true)
      if (cancelled) return
      // Strictly `state === 'reveal'` -- Station 3 sets this only after the
      // visitor is actually done (notifyRevealReadyFromVisit). Do NOT use
      // pickVisitForReveal()'s looser fallback (still-at-station-3/2), which
      // would trigger the wall while someone is mid-interview.
      const candidates = peekActiveVisits().filter((v) => v.state === 'reveal')
      const visit = candidates.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0))[0]
      if (!visit?.visit_id || seenVisitIds.has(visit.visit_id) || activeJobIdRef.current) return
      seenVisitIds.add(visit.visit_id)
      const cue = await collageCueFromVisitCentral()
      if (cancelled) return
      pendingSeedRef.current = mintPhotobashSeed()
      pendingCueRef.current = cue
      activeJobIdRef.current = `central-${visit.visit_id}`
      setHasRevealed(true)
      setCycleKey((key) => key + 1)
    }
    void poll()
    const timer = window.setInterval(poll, 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isConductor])

  useEffect(() => {
    if (!isConductor || !hasRevealed) return
    let cancelled = false
    let raf = 0
    let timeout = 0

    const run = async () => {
      const seed = pendingSeedRef.current ?? mintPhotobashSeed()
      const cueOverride = pendingCueRef.current
      pendingSeedRef.current = null
      pendingCueRef.current = null
      const start = performance.now()
      setPhotobashSeed(seed)
      setLoadingProgress(0)
      await refreshVisitCache(true)
      if (cancelled) return
      const cue = cueOverride ?? (await collageCueFromVisitCentral())
      setCollageCue(cue)
      const publishProgress = (progress: number) => {
        channelRef.current?.postMessage({
          type: 'phase',
          phase: 'loading',
          countdown: null,
          recordSecondsLeft: 0,
          loadingProgress: progress,
          photobashSeed: seed,
          collageCue: cue,
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
      timeout = window.setTimeout(() => {
        if (!cancelled) {
          const jobId = activeJobIdRef.current
          if (jobId) {
            completeActivePhotowallJob(jobId)
            activeJobIdRef.current = null
          }
          setCycleKey((key) => key + 1)
        }
      }, PHOTOBASH_CYCLE_MS)
    }

    void run()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timeout)
    }
  }, [isConductor, hasRevealed, cycleKey])

  return { photobashSeed, collageCue, loadingProgress, cycleKey, hasRevealed }
}
