import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import { getDeviceQuality } from '../lib/deviceQuality'
import { readDeviceLock } from '../lib/deviceLock'
import { showTuningPanel } from '../lib/tune'
import { useMicLevel } from '../hooks/useMicLevel'
import { useSpeechDictation } from '../hooks/useSpeechDictation'
import { useWhisperDictation } from '../hooks/useWhisperDictation'
import { useStationVibe } from '../hooks/useStationVibe'
import { useVisitCentralPoll } from '../hooks/useVisitCentral'
import { isStationTurnActive, visitSessionKeyForStation } from '../lib/visitCentral'
import { deriveStationStatus } from '../lib/stationStatus'
import { prepareKioskVisit, submitKioskInterview } from '../lib/arsIngest'
import { captionLines } from '../lib/captionLines'
import { isTranscriptHotkey } from '../lib/productionHotkey'
import type { WallPhase } from '../lib/wallPhaseSync'
import { publish } from '../lib/firehose'
import { publishKeyboardFocus, startKeyboardFocusHeartbeat } from '../lib/keyboardFocus'
import { PHOTOBASH_FILL_MS } from '../lib/photobashLoop'
import { notifyRevealReadyFromVisit } from '../lib/photobashTrigger'
import { MirrorGuideOrb } from './MirrorGuideOrb'
import { MirrorHeadline } from './MirrorHeadline'
import { JourneyHeadline } from './JourneyHeadline'
import { CodePanel, MiniBar } from './HudDebris'
import { StationTurnWait } from './StationTurnWait'
import './ThirdStation.css'

const MirrorDevPanel = lazy(() =>
  import('../dev/MirrorDevPanel').then((m) => ({ default: m.MirrorDevPanel })),
)

type Phase = WallPhase

const LIVE_POLL_MS = 150

const STATUS_LABEL_WARM: Record<Phase, string> = {
  intro: 'Ready',
  prompt: 'Listening',
  recording: 'Recording',
  loading: 'Working',
  handoff: 'Ready',
}

const STATUS_LABEL_ORIGINAL: Record<Phase, string> = {
  intro: 'STANDBY',
  prompt: 'LISTENING',
  recording: 'RECORDING',
  loading: 'PROCESSING',
  handoff: 'READY',
}

/**
 * Bridges mirrorSettings.background/accent (plain objects, no leva
 * dependency, safe for production) into CSS custom properties — set on
 * this component's own root element only, never redeclared anywhere else
 * in ThirdStation.css, so there's no risk of the local-declaration-shadows-
 * ancestor bug that broke the Cards station's color controls.
 */
function useLiveMirrorTheme(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const apply = () => {
      const root = rootRef.current
      if (!root) return
      root.style.setProperty('--mirror-bg-top', mirrorSettings.background.top)
      root.style.setProperty('--mirror-bg-bottom', mirrorSettings.background.bottom)
      root.style.setProperty('--mirror-accent', mirrorSettings.accent.color)
    }
    apply()
    if (!import.meta.env.DEV) return

    let raf = 0
    let last = 0
    const tick = (now: number) => {
      if (now - last >= LIVE_POLL_MS) {
        last = now
        apply()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rootRef])
}

/** The 3-2-1 countdown reuses the same dot row shown during the reading
 * hold — filling in one dot per step — rather than switching to numerals,
 * so the countdown stays in the orb's point/particle visual language. */
function Dots({ lit }: { lit: number }) {
  return (
    <div className="mirror-dots" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < lit ? 'mirror-dot is-lit' : 'mirror-dot'} />
      ))}
    </div>
  )
}

/** Each ring segment is drawn twice — a wider, blurred "glow" arc behind a
 * thinner crisp one — matching the reference's soft double-layered ring
 * rather than a single flat stroke. */
function RingSegments({ rotation }: { rotation: number }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={`glow-${i}`}
          cx="100"
          cy="100"
          r="86"
          className="mirror-loading-arc mirror-loading-arc-glow"
          style={{ transform: `rotate(${i * 90 + rotation}deg)`, transformOrigin: '100px 100px' }}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={`crisp-${i}`}
          cx="100"
          cy="100"
          r="86"
          className="mirror-loading-arc"
          style={{ transform: `rotate(${i * 90 + rotation}deg)`, transformOrigin: '100px 100px' }}
        />
      ))}
    </>
  )
}

/** Slowly spun by a CSS animation — the idle companion to the loading
 * screen's progress-driven ring, present whenever the orb is on screen so
 * the ring reads as one continuous motif, not something that only appears
 * once at the end. */
function IdleRing() {
  return (
    <div className="mirror-idle-ring" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <RingSegments rotation={0} />
      </svg>
    </div>
  )
}

function LoadingRing({ progress }: { progress: number }) {
  return (
    <div className="mirror-loading-ring" aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <RingSegments rotation={progress * 360} />
      </svg>
    </div>
  )
}

type DebrisPanel = {
  seed: number
  blockCount?: number
  visibleRows?: number
  large?: boolean
  duration?: number
  hasAlert?: boolean
  ghost?: boolean
  style: CSSProperties
}
type DebrisBar = { style: CSSProperties; fill: number }

/** A different arrangement — different corners, different seeds (so the
 * content itself differs, not just position) — per phase, so the debris
 * visibly relocates and rewrites itself each time the scene changes
 * instead of sitting frozen in one spot for the whole loop. */
const DEBRIS_LAYOUTS: Record<Phase, { panels: DebrisPanel[]; bars: DebrisBar[] }> = {
  intro: {
    panels: [
      {
        seed: 1,
        blockCount: 3,
        visibleRows: 10,
        large: true,
        hasAlert: true,
        duration: 10,
        style: { top: '68px', left: '37px', opacity: 0.4 },
      },
      {
        seed: 2,
        blockCount: 2,
        visibleRows: 6,
        ghost: true,
        duration: 13,
        style: { top: '154px', left: '58px', opacity: 0.16 },
      },
      {
        seed: 3,
        blockCount: 2,
        visibleRows: 6,
        duration: 11,
        style: { top: '96px', right: '-16px', opacity: 0.24 },
      },
    ],
    bars: [
      { style: { top: '58px', right: '46%', opacity: 0.2 }, fill: 35 },
      { style: { top: '216px', left: '-6px', opacity: 0.16 }, fill: 62 },
    ],
  },
  prompt: {
    panels: [
      {
        seed: 5,
        blockCount: 3,
        visibleRows: 10,
        large: true,
        hasAlert: true,
        duration: 9,
        style: { bottom: '15%', left: '-14px', opacity: 0.32 },
      },
      {
        seed: 6,
        blockCount: 2,
        visibleRows: 6,
        ghost: true,
        duration: 12,
        style: { bottom: 'calc(15% - 30px)', left: '40px', opacity: 0.15 },
      },
      {
        seed: 7,
        blockCount: 2,
        visibleRows: 6,
        duration: 10,
        style: { top: '70px', right: '30px', opacity: 0.22 },
      },
    ],
    bars: [
      { style: { top: '60px', left: '40px', opacity: 0.18 }, fill: 48 },
      { style: { bottom: '9%', right: '-6px', opacity: 0.2 }, fill: 28 },
    ],
  },
  recording: {
    panels: [
      {
        seed: 8,
        blockCount: 3,
        visibleRows: 10,
        large: true,
        hasAlert: true,
        duration: 8,
        style: { top: '64px', right: '-16px', opacity: 0.3 },
      },
      {
        seed: 9,
        blockCount: 2,
        visibleRows: 6,
        ghost: true,
        duration: 11,
        style: { top: '150px', right: '10px', opacity: 0.14 },
      },
      {
        seed: 10,
        blockCount: 2,
        visibleRows: 6,
        duration: 10,
        style: { bottom: '16%', left: '-14px', opacity: 0.22 },
      },
    ],
    bars: [
      { style: { top: '210px', left: '20px', opacity: 0.18 }, fill: 55 },
      { style: { bottom: '8%', right: '30px', opacity: 0.2 }, fill: 40 },
    ],
  },
  loading: {
    panels: [
      {
        seed: 11,
        blockCount: 3,
        visibleRows: 10,
        large: true,
        hasAlert: true,
        duration: 10,
        style: { bottom: '15%', right: '-16px', opacity: 0.34 },
      },
      {
        seed: 12,
        blockCount: 2,
        visibleRows: 6,
        ghost: true,
        duration: 13,
        style: { bottom: 'calc(15% - 28px)', right: '38px', opacity: 0.15 },
      },
      {
        seed: 0,
        blockCount: 2,
        visibleRows: 6,
        duration: 11,
        style: { top: '70px', left: '-12px', opacity: 0.22 },
      },
    ],
    bars: [
      { style: { top: '150px', right: '40px', opacity: 0.18 }, fill: 44 },
      { style: { top: '58px', left: '46%', opacity: 0.2 }, fill: 30 },
    ],
  },
  handoff: {
    panels: [
      {
        seed: 13,
        blockCount: 2,
        visibleRows: 8,
        duration: 12,
        style: { top: '80px', left: '28px', opacity: 0.2 },
      },
      {
        seed: 14,
        blockCount: 2,
        visibleRows: 6,
        ghost: true,
        duration: 14,
        style: { bottom: '18%', right: '24px', opacity: 0.14 },
      },
    ],
    bars: [{ style: { top: '120px', right: '36px', opacity: 0.16 }, fill: 100 }],
  },
}

/** Persistent scattered technical debris — small scrolling log panels, one
 * deliberately overlapping a second "ghost" panel behind it, and a couple
 * mini progress bars — living around the main content. The arrangement
 * (position AND content) switches per DEBRIS_LAYOUTS above whenever the
 * phase changes, rather than one fixed set of panels sitting there for
 * the whole loop. Positions stay off-grid/asymmetric (odd offsets, a
 * couple clipped right at the frame edge) and flat/unrotated. */
function HudDebrisField({ phase }: { phase: Phase }) {
  const layout = DEBRIS_LAYOUTS[phase]
  return (
    <div className="mirror-hud-debris" aria-hidden="true">
      {layout.panels.map((p, i) => (
        <CodePanel key={i} {...p} big />
      ))}
      {layout.bars.map((b, i) => (
        <MiniBar key={i} style={b.style} fill={b.fill} />
      ))}
    </div>
  )
}

function GuideOrb({ variant, progress }: { variant: 'idle' | 'loading'; progress?: number }) {
  return (
    <div className="mirror-orb-ring-slot">
      <MirrorGuideOrb className="mirror-orb-canvas" />
      {variant === 'idle' ? <IdleRing /> : <LoadingRing progress={progress ?? 0} />}
    </div>
  )
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** Remaining countdown stroke pinned at 12 o'clock, retracting clockwise so
 *  only one end moves instead of a gap opening and dropping both sides. */
function remainingArcPath(cx: number, cy: number, r: number, remaining: number) {
  const span = Math.max(0, Math.min(1, remaining)) * 360
  if (span <= 0) return ''
  if (span >= 359.9) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r}`
  }
  const start = polar(cx, cy, r, -90)
  const end = polar(cx, cy, r, -90 + span)
  const large = span > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
}

function RecordingStage({
  secondsLeft,
  totalSeconds,
  transcript,
  stream,
}: {
  secondsLeft: number
  totalSeconds: number
  transcript: string
  stream: MediaStream | null
}) {
  const remaining = Math.max(0, Math.min(1, secondsLeft / totalSeconds))
  const bars = useMicLevel(true, stream)
  const arc = remainingArcPath(40, 40, 34, remaining)
  const spoken = transcript.trim()
  const lines = captionLines(spoken, 3, 28)

  return (
    <div className="mirror-screen mirror-screen-recording is-live">
      <div className="mirror-record-frame">
        <div className="mirror-rec-indicator">
          <span className="mirror-rec-dot" />
          <span className="mirror-rec-label">
            <span className="journey-headline-copy">REC</span>
            <MirrorHeadline
              lines={['REC']}
              fontPx={18}
              width={72}
              height={28}
              fade={false}
              align="left"
              className="mirror-rec-haze"
            />
          </span>
        </div>
        <div className="mirror-record-body">
          {spoken ? (
            <p className="mirror-record-caption">{lines.join('\n')}</p>
          ) : (
            <JourneyHeadline
              as="p"
              className="mirror-record-prompt"
              lines={lines}
              fontPx={52}
              fade={false}
            >
              speak about yourself
            </JourneyHeadline>
          )}
          <div className="mirror-record-levels" aria-hidden="true">
            {bars.map((value, i) => (
              <span
                key={i}
                className="mirror-record-level-bar"
                style={{ '--h': value } as CSSProperties}
              />
            ))}
          </div>
          <div className="mirror-record-timer">
            <svg viewBox="0 0 80 80" className="mirror-record-timer-ring">
              <defs>
                <filter id="mirror-record-ice-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="1.6" />
                </filter>
              </defs>
              <circle cx="40" cy="40" r="34" className="mirror-record-timer-track" />
              {arc ? (
                <>
                  <path
                    d={arc}
                    className="mirror-record-timer-progress-glow"
                    filter="url(#mirror-record-ice-glow)"
                  />
                  <path d={arc} className="mirror-record-timer-progress" />
                </>
              ) : null}
            </svg>
            <span className="journey-headline-copy">{Math.ceil(secondsLeft)}</span>
            <MirrorHeadline
              key={Math.ceil(secondsLeft)}
              lines={[String(Math.ceil(secondsLeft))]}
              fontPx={26}
              width={72}
              height={72}
              fade={false}
              className="mirror-record-timer-haze"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ThirdStation() {
  const visits = useVisitCentralPoll()
  if (!isStationTurnActive(3, visits)) {
    const status = deriveStationStatus(3, visits)
    return <StationTurnWait station="III" stationId="station-3" detail={status.detail} />
  }
  return <ThirdStationSession key={visitSessionKeyForStation(3, visits)} />
}

function ThirdStationSession() {
  const [vibe] = useStationVibe()
  const warm = vibe === 'warm'
  const rootRef = useRef<HTMLElement>(null)
  useLiveMirrorTheme(rootRef)

  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState<number | null>(null)
  // Gate between "introduce yourself" and the recording countdown --
  // waits for an explicit Yes (iPad button / 'y' key, same remote-input
  // path MirrorChoice uses) so the recording frame never appears until
  // the visitor actually confirms they're ready.
  const [awaitingReady, setAwaitingReady] = useState(false)
  // 'yes' or 'skip' -- whichever the visitor pressed at the Ready gate.
  // A ref (not state) since it only needs to be read once, later, inside
  // the phase==='loading' completion effect below.
  const readyAnswerRef = useRef<'yes' | 'skip' | null>(null)
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(mirrorSettings.timing.recordingSeconds)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const prevPhaseRef = useRef<Phase | null>(null)
  const completionRef = useRef(false)
  const recording = phase === 'recording'
  const spokenIntro = useSpeechDictation(recording)
  const whisper = useWhisperDictation(recording)
  const caption = spokenIntro.trim() || whisper.text
  const spokenRef = useRef('')
  spokenRef.current = caption
  const flushIntro = whisper.flush
  const [showCaption, setShowCaption] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTranscriptHotkey(event)) return
      event.preventDefault()
      setShowCaption((on) => !on)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    publish('station-3', 'station_mounted', { phase: 'intro' })
    publishKeyboardFocus('station-3', 'hidden')
  }, [])

  useEffect(() => {
    if (prevPhaseRef.current !== phase) {
      if (prevPhaseRef.current !== null) {
        publish('station-3', `phase:${phase}`, { phase })
      }
      prevPhaseRef.current = phase
    }
    if (phase === 'loading' && !completionRef.current) {
      completionRef.current = true
      const visitContextPromise = prepareKioskVisit()
      void flushIntro().then((final) => {
        const spoken = final.trim() || spokenRef.current
        void visitContextPromise.then((visitContext) => {
          void submitKioskInterview(spoken, visitContext).then((built) => {
            void notifyRevealReadyFromVisit({
              readyAnswer: readyAnswerRef.current ?? undefined,
              transcript: built.intro,
              transcriptSource: built.transcriptSource,
              visitId: visitContext?.visitId ?? null,
            })
          })
        })
      })
    }
  }, [phase, flushIntro])

  const startRecordingCountdown = useCallback(() => {
    const t = mirrorSettings.timing
    setCountdown(3)
    window.setTimeout(() => {
      setCountdown(2)
      window.setTimeout(() => {
        setCountdown(1)
        window.setTimeout(() => {
          setCountdown(null)
          setPhase('recording')
        }, t.countdownStepSeconds * 1000)
      }, t.countdownStepSeconds * 1000)
    }, t.countdownStepSeconds * 1000)
  }, [])

  // Phase advance chain — reads current durations at the moment each timer
  // is scheduled, so tuning the panel mid-loop takes effect next cycle
  // rather than needing a remount.
  useEffect(() => {
    const timers: number[] = []
    const t = mirrorSettings.timing

    if (phase === 'intro') {
      timers.push(window.setTimeout(() => setPhase('prompt'), t.introSeconds * 1000))
    } else if (phase === 'prompt') {
      setCountdown(null)
      if (!awaitingReady) {
        timers.push(window.setTimeout(() => setAwaitingReady(true), t.promptSeconds * 1000))
      }
    } else if (phase === 'recording') {
      setRecordSecondsLeft(t.recordingSeconds)
      timers.push(window.setTimeout(() => setPhase('loading'), t.recordingSeconds * 1000))
    } else if (phase === 'loading') {
      setLoadingProgress(0)
      timers.push(window.setTimeout(() => setPhase('handoff'), PHOTOBASH_FILL_MS))
    }

    return () => timers.forEach((id) => window.clearTimeout(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (!awaitingReady) return
    const stopHeartbeat = startKeyboardFocusHeartbeat('station-3', 'yesno', {
      prompt: 'Ready?',
      left: 'Yes',
      right: 'Skip',
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const key = event.key.toLowerCase()
      if (key !== 'y' && key !== 'n') return
      event.preventDefault()
      setAwaitingReady(false)
      publishKeyboardFocus('station-3', 'hidden')
      if (key === 'y') {
        readyAnswerRef.current = 'yes'
        startRecordingCountdown()
      } else {
        // Skip -- decline to record, go straight to the match/loading step.
        readyAnswerRef.current = 'skip'
        setPhase('loading')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      stopHeartbeat()
    }
  }, [awaitingReady, startRecordingCountdown])

  // Second-by-second recording countdown display + smooth loading progress —
  // both derived from elapsed time against the same durations used above.
  useEffect(() => {
    if (phase !== 'recording') return
    const start = performance.now()
    const total = mirrorSettings.timing.recordingSeconds * 1000
    let raf = 0
    const tick = () => {
      const elapsed = performance.now() - start
      setRecordSecondsLeft(Math.max(0, (total - elapsed) / 1000))
      if (elapsed < total) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  useEffect(() => {
    if (phase !== 'loading') return
    const fillMs = PHOTOBASH_FILL_MS
    const holdMs = mirrorSettings.timing.loadingSeconds * 1000
    const start = performance.now()
    let raf = 0
    const tick = () => {
      const elapsed = performance.now() - start
      setLoadingProgress(Math.min(1, elapsed / fillMs))
      if (elapsed < holdMs) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  return (
    <section className="third-station" aria-label="Mirror station" ref={rootRef}>
      <div className="mirror-frame">
        {phase === 'prompt' || phase === 'recording' ? null : (
          <div className="mirror-status-label" aria-hidden="true">
            <span className="mirror-status-marker" />
            {(warm ? STATUS_LABEL_WARM : STATUS_LABEL_ORIGINAL)[phase]}
          </div>
        )}
        {getDeviceQuality() === 'kiosk' ? null : <HudDebrisField phase={phase} key={phase} />}

        {phase === 'intro' ? (
          <div className="mirror-screen mirror-screen-intro">
            <GuideOrb variant="idle" />
            <MirrorHeadline lines={['Now is your chance']} className="mirror-headline" />
          </div>
        ) : null}

        {phase === 'prompt' && !awaitingReady ? (
          <div className="mirror-screen mirror-screen-prompt">
            <GuideOrb variant="idle" />
            <MirrorHeadline
              lines={['Introduce yourself to', 'your future partner']}
              className="mirror-headline"
            />
            <Dots lit={countdown === null ? 0 : 4 - countdown} />
          </div>
        ) : null}

        {phase === 'prompt' && awaitingReady ? (
          <div className="mirror-screen mirror-screen-prompt">
            <GuideOrb variant="idle" />
            <MirrorHeadline lines={['Ready?']} className="mirror-headline" />
          </div>
        ) : null}

        {recording ? (
          <RecordingStage
            secondsLeft={recordSecondsLeft}
            totalSeconds={mirrorSettings.timing.recordingSeconds}
            transcript={showCaption ? caption : ''}
            stream={whisper.stream}
          />
        ) : null}

        {phase === 'loading' ? (
          <div className="mirror-screen mirror-screen-loading">
            <MirrorHeadline
              lines={warm ? ['Finding', 'your match'] : ['Creating', 'match']}
              className="mirror-headline"
            />
            <GuideOrb variant="loading" progress={loadingProgress} />
            <div className="mirror-loading-readout">
              {warm
                ? `Putting it together, ${Math.round(loadingProgress * 100)}%`
                : `COMPILING MATCH DATA — ${Math.round(loadingProgress * 100)}%`}
            </div>
          </div>
        ) : null}

        {phase === 'handoff' ? (
          <div className="mirror-screen mirror-screen-handoff">
            <JourneyHeadline
              lines={[warm ? 'Go meet your match' : 'Meet your match']}
              className="mirror-headline"
              fontPx={88}
            >
              {warm ? 'Go meet your match' : 'Meet your match'}
            </JourneyHeadline>
            <GuideOrb variant="idle" />
            <div className="mirror-handoff-readout">
              {warm ? 'Turn to the wall — they are waiting for you.' : 'PROCEED TO THE REVEAL WALL'}
            </div>
          </div>
        ) : null}
      </div>

      {showTuningPanel() && !readDeviceLock() ? (
        <Suspense fallback={null}>
          <MirrorDevPanel />
        </Suspense>
      ) : null}
    </section>
  )
}
