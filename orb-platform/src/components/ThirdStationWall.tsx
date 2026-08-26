import { useEffect, useRef } from 'react'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import { useWallSyncedPhase } from '../lib/wallPhaseSync'
import { parseWallRole, type WallRole } from '../lib/wallRole'
import { CodePanel, MiniBar } from './HudDebris'
import { MirrorGuideOrb } from './MirrorGuideOrb'
import { MirrorHeadline } from './MirrorHeadline'
import { WallFaceBlanket } from './WallFaceBlanket'
import './ThirdStation.css'
import './ThirdStationWall.css'

const STATUS_LABEL = {
  intro: 'STANDBY',
  prompt: 'LISTENING',
  recording: 'RECORDING',
  loading: 'PROCESSING',
} as const

function Dots({ lit }: { lit: number }) {
  return (
    <div className="mirror-dots" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < lit ? 'mirror-dot is-lit' : 'mirror-dot'} />
      ))}
    </div>
  )
}

function WallCodePanel() {
  return (
    <div className="wall-role wall-role-code" aria-hidden="true">
      <CodePanel
        seed={1}
        blockCount={5}
        visibleRows={18}
        large
        big
        hasAlert
        duration={9}
        style={{ top: '6%', left: '6%', right: '6%', bottom: '28%' }}
      />
      <CodePanel
        seed={4}
        blockCount={3}
        visibleRows={10}
        ghost
        big
        duration={12}
        style={{ top: '58%', left: '10%', right: '10%', opacity: 0.45 }}
      />
      <MiniBar style={{ bottom: '8%', left: '8%', width: '40%' }} fill={62} />
      <MiniBar style={{ bottom: '8%', right: '8%', width: '28%' }} fill={38} />
    </div>
  )
}

function WallDebraPanel({
  phase,
  loadingProgress,
}: {
  phase: keyof typeof STATUS_LABEL
  loadingProgress: number
}) {
  return (
    <div className="wall-role wall-role-debra">
      <div className="wall-debra-orb">
        <MirrorGuideOrb className="wall-debra-canvas" />
        {phase === 'loading' ? (
          <div className="wall-debra-progress" aria-hidden="true">
            {Math.round(loadingProgress * 100)}%
          </div>
        ) : null}
      </div>
    </div>
  )
}

function WallCopyPanel({
  phase,
  countdown,
}: {
  phase: keyof typeof STATUS_LABEL
  countdown: number | null
}) {
  const lines =
    phase === 'intro'
      ? ['Now is your chance']
      : phase === 'prompt'
        ? ['Introduce yourself to', 'your future partner']
        : phase === 'recording'
          ? ['Speak clearly', 'into the room']
          : ['Creating', 'match']

  return (
    <div className="wall-role wall-role-copy">
      <MirrorHeadline lines={lines} className="mirror-headline wall-copy-headline" />
      {phase === 'prompt' ? <Dots lit={countdown === null ? 0 : 4 - countdown} /> : null}
    </div>
  )
}

function WallGuidePanel({ phase }: { phase: keyof typeof STATUS_LABEL }) {
  const active = phase === 'loading' || phase === 'recording'
  const look = active ? 'Look up-right — your match is forming' : 'Your match appears on the tall screen'

  return (
    <div className={`wall-role wall-role-guide${active ? ' is-active' : ''}`}>
      <p className="wall-guide-label">{look}</p>
      <svg className="wall-guide-arrows" viewBox="0 0 400 220" aria-hidden="true">
        <path
          className="wall-guide-path"
          d="M40 180 C 120 170, 180 80, 310 42"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          className="wall-guide-path"
          d="M286 28 L330 38 L300 70"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M70 200 C 150 150, 220 90, 340 58"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.35"
          strokeLinecap="round"
        />
        <circle className="wall-guide-pulse" cx="330" cy="38" r="8" fill="currentColor" />
      </svg>
    </div>
  )
}

function WallAvatarPanel({ phase }: { phase: keyof typeof STATUS_LABEL }) {
  // During loading the whole wall switches to the blanketed face image.
  return (
    <div className="wall-role wall-role-avatar">
      <div className="wall-avatar-wait">
        <span className="wall-avatar-wait-mark" />
        {phase === 'recording' ? 'CAPTURING VOICEPRINT' : 'AWAITING MATCH'}
      </div>
    </div>
  )
}

function WallStatusPanel({
  phase,
  recordSecondsLeft,
  loadingProgress,
}: {
  phase: keyof typeof STATUS_LABEL
  recordSecondsLeft: number
  loadingProgress: number
}) {
  const total = mirrorSettings.timing.recordingSeconds
  const progress = phase === 'recording' ? 1 - recordSecondsLeft / total : loadingProgress

  return (
    <div className="wall-role wall-role-status">
      <div className="wall-status-label">
        <span className="mirror-status-marker" />
        {STATUS_LABEL[phase]}
      </div>
      {phase === 'recording' ? (
        <div className="wall-status-timer">
          <div className="mirror-rec-indicator">
            <span className="mirror-rec-dot" />
            REC
          </div>
          <div className="wall-status-seconds">{Math.ceil(recordSecondsLeft)}</div>
        </div>
      ) : null}
      {phase === 'loading' ? (
        <div className="wall-status-loading">
          <div className="wall-status-bar">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="wall-status-readout">{`COMPILING — ${Math.round(progress * 100)}%`}</div>
        </div>
      ) : null}
      {phase === 'intro' || phase === 'prompt' ? (
        <div className="wall-status-idle">SYSTEM ONLINE</div>
      ) : null}
    </div>
  )
}

function WallRoleContent({
  role,
  phase,
  countdown,
  recordSecondsLeft,
  loadingProgress,
}: {
  role: WallRole
  phase: keyof typeof STATUS_LABEL
  countdown: number | null
  recordSecondsLeft: number
  loadingProgress: number
}) {
  switch (role) {
    case 'code':
      return <WallCodePanel />
    case 'debra':
      return <WallDebraPanel phase={phase} loadingProgress={loadingProgress} />
    case 'copy':
      return <WallCopyPanel phase={phase} countdown={countdown} />
    case 'guide':
      return <WallGuidePanel phase={phase} />
    case 'avatar':
      return <WallAvatarPanel phase={phase} />
    case 'status':
      return (
        <WallStatusPanel
          phase={phase}
          recordSecondsLeft={recordSecondsLeft}
          loadingProgress={loadingProgress}
        />
      )
  }
}

export function ThirdStationWall({ role: roleProp }: { role?: WallRole }) {
  const role = roleProp ?? parseWallRole() ?? 'copy'
  const isConductor = role === 'debra'
  const { phase, countdown, recordSecondsLeft, loadingProgress } = useWallSyncedPhase(isConductor)
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    document.documentElement.dataset.wallMode = 'true'
    document.documentElement.dataset.wallRole = role
    return () => {
      delete document.documentElement.dataset.wallMode
      delete document.documentElement.dataset.wallRole
    }
  }, [role])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.style.setProperty('--mirror-bg-top', mirrorSettings.background.top)
    root.style.setProperty('--mirror-bg-bottom', mirrorSettings.background.bottom)
    root.style.setProperty('--mirror-accent', mirrorSettings.accent.color)
  }, [])

  return (
    <section
      className={`third-station third-station-wall third-station-wall-${role}`}
      aria-label={`Mirror wall panel: ${role}`}
      ref={rootRef}
    >
      {phase === 'loading' ? (
        <WallFaceBlanket role={role} />
      ) : (
        <WallRoleContent
          role={role}
          phase={phase}
          countdown={countdown}
          recordSecondsLeft={recordSecondsLeft}
          loadingProgress={loadingProgress}
        />
      )}
    </section>
  )
}
