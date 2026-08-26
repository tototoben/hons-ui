import { useEffect, useRef, useState } from 'react'
import { mirrorSettings } from '../dev/mirrorSettingsStore'

export type WallPhase = 'intro' | 'prompt' | 'recording' | 'loading'

const CHANNEL = 'hons-station3-wall-phase'

type PhaseMessage = {
  type: 'phase'
  phase: WallPhase
  countdown: number | null
  recordSecondsLeft: number
  loadingProgress: number
}

/**
 * Keep all wall-role Chrome windows on the same Station III beat.
 * The Debra panel is the conductor; other roles only listen.
 */
export function useWallSyncedPhase(isConductor: boolean) {
  const [phase, setPhase] = useState<WallPhase>('intro')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(mirrorSettings.timing.recordingSeconds)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const channelRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<PhaseMessage>) => {
      if (isConductor || event.data?.type !== 'phase') return
      setPhase(event.data.phase)
      setCountdown(event.data.countdown)
      setRecordSecondsLeft(event.data.recordSecondsLeft)
      setLoadingProgress(event.data.loadingProgress)
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
    const t = mirrorSettings.timing

    if (phase === 'intro') {
      publish({ phase, countdown: null, recordSecondsLeft, loadingProgress: 0 })
      timers.push(window.setTimeout(() => setPhase('prompt'), t.introSeconds * 1000))
    } else if (phase === 'prompt') {
      setCountdown(null)
      publish({ phase, countdown: null, recordSecondsLeft, loadingProgress: 0 })
      timers.push(
        window.setTimeout(() => {
          setCountdown(3)
          publish({ phase, countdown: 3, recordSecondsLeft, loadingProgress: 0 })
          timers.push(
            window.setTimeout(() => {
              setCountdown(2)
              publish({ phase, countdown: 2, recordSecondsLeft, loadingProgress: 0 })
              timers.push(
                window.setTimeout(() => {
                  setCountdown(1)
                  publish({ phase, countdown: 1, recordSecondsLeft, loadingProgress: 0 })
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
      publish({ phase, countdown: null, recordSecondsLeft: t.recordingSeconds, loadingProgress: 0 })
      timers.push(window.setTimeout(() => setPhase('loading'), t.recordingSeconds * 1000))
    } else if (phase === 'loading') {
      setLoadingProgress(0)
      publish({ phase, countdown: null, recordSecondsLeft: 0, loadingProgress: 0 })
      timers.push(window.setTimeout(() => setPhase('intro'), t.loadingSeconds * 1000))
    }

    return () => timers.forEach((id) => window.clearTimeout(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConductor, phase])

  useEffect(() => {
    if (!isConductor || phase !== 'recording') return
    const start = performance.now()
    const total = mirrorSettings.timing.recordingSeconds * 1000
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
      } satisfies PhaseMessage)
      if (elapsed < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConductor, phase])

  useEffect(() => {
    if (!isConductor || phase !== 'loading') return
    const start = performance.now()
    const total = mirrorSettings.timing.loadingSeconds * 1000
    let raf = 0
    const tick = () => {
      const elapsed = performance.now() - start
      const progress = Math.min(1, elapsed / total)
      setLoadingProgress(progress)
      channelRef.current?.postMessage({
        type: 'phase',
        phase,
        countdown: null,
        recordSecondsLeft: 0,
        loadingProgress: progress,
      } satisfies PhaseMessage)
      if (elapsed < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isConductor, phase])

  return { phase, countdown, recordSecondsLeft, loadingProgress }
}
