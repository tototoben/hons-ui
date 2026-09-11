import { useEffect, useMemo, useRef } from 'react'
import { dialogueOwnsWall, useRevealDialogue, type RevealDialogueState } from '../lib/revealDialogue'
import { parseWallCaptureParams } from '../lib/wallCapture'
import { useWallSyncedPhase } from '../lib/wallPhaseSync'
import { parseWallCalibrate, parseWallCollage, parseWallRole, type WallRole } from '../lib/wallRole'
import { RevealShellChrome } from './RevealShellChrome'
import { WallCalibrate } from './WallCalibrate'
import { CodePanel, MiniBar } from './HudDebris'
import { MirrorGuideOrb } from './MirrorGuideOrb'
import { MirrorHeadline } from './MirrorHeadline'
import { WallFaceBlanket } from './WallFaceBlanket'
import { WallCollageBlanket } from './WallCollageBlanket'
import { WallFormingBlanket } from './WallFormingBlanket'
import { useCollageBankReady } from '../lib/wallCollageBank'
import { pickWallLoadingSurface, shouldShowForming } from '../lib/wallForming'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import './ThirdStation.css'
import './ThirdStationWall.css'

const STATUS_LABEL = {
  intro: 'STANDBY',
  prompt: 'LISTENING',
  recording: 'RECORDING',
  loading: 'PROCESSING',
  handoff: 'HANDOFF',
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
        blockCount={6}
        visibleRows={22}
        large
        big
        hasAlert
        duration={8}
        style={{ top: '3%', left: '3%', right: '3%', bottom: '22%' }}
      />
      <CodePanel
        seed={7}
        blockCount={4}
        visibleRows={12}
        ghost
        big
        duration={11}
        style={{ top: '62%', left: '5%', right: '5%', opacity: 0.55 }}
      />
      <MiniBar style={{ bottom: '5%', left: '5%', width: '42%' }} fill={72} />
      <MiniBar style={{ bottom: '5%', right: '5%', width: '34%' }} fill={44} />
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

function WallParticleField({ count = 48, active = false }: { count?: number; active?: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: ((i * 47) % 100) + (i % 7) * 0.3,
        top: ((i * 31) % 100) + (i % 5) * 0.4,
        size: 2 + (i % 5) * 1.4,
        delay: (i % 12) * 0.22,
        duration: 3.2 + (i % 8) * 0.45,
      })),
    [count],
  )

  return (
    <div className={`wall-particles${active ? ' is-active' : ''}`} aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="wall-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      <div className="wall-particle-veils">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

function WallGuidePanel({ phase }: { phase: keyof typeof STATUS_LABEL }) {
  const active = phase === 'recording' || phase === 'prompt'
  return (
    <div className={`wall-role wall-role-guide${active ? ' is-active' : ''}`}>
      <WallParticleField count={64} active={active} />
    </div>
  )
}

function WallAvatarPanel({ phase }: { phase: keyof typeof STATUS_LABEL }) {
  return (
    <div className="wall-role wall-role-avatar">
      <WallParticleField count={36} active={phase === 'recording'} />
      <div className="wall-avatar-wait">
        <span className="wall-avatar-wait-mark" />
        {phase === 'recording' ? 'CAPTURING VOICEPRINT' : 'AWAITING MATCH'}
      </div>
    </div>
  )
}

function WallWaveform({ active, level }: { active: boolean; level?: number }) {
  const bars = useMemo(() => Array.from({ length: 28 }, (_, i) => i), [])
  const isMeter = typeof level === 'number'
  return (
    <div className={`wall-waveform${active ? ' is-live' : ''}`} aria-hidden="true">
      {bars.map((i) => (
        <span
          key={i}
          style={{
            animationDelay: `${(i % 9) * 0.08}s`,
            height: isMeter
              ? `${Math.max(8, Math.min(100, level * 110 * (0.45 + ((i * 7) % 11) / 16)))}%`
              : undefined,
          }}
        />
      ))}
    </div>
  )
}

function WallRadar({ active }: { active: boolean }) {
  return (
    <div className={`wall-radar${active ? ' is-live' : ''}`} aria-hidden="true">
      <span className="wall-radar-ring" />
      <span className="wall-radar-ring" />
      <span className="wall-radar-ring" />
      <span className="wall-radar-sweep" />
      <span className="wall-radar-core" />
    </div>
  )
}

function WallStatusPanel({
  phase,
  recordSecondsLeft,
}: {
  phase: keyof typeof STATUS_LABEL
  recordSecondsLeft: number
  loadingProgress: number
}) {
  const listening = phase === 'prompt' || phase === 'intro'
  const recording = phase === 'recording'

  return (
    <div className="wall-role wall-role-status">
      <WallParticleField count={28} active={listening || recording} />
      <div className="wall-status-stack">
        <WallRadar active={listening || recording} />
        <div className="wall-status-label">
          <span className="mirror-status-marker" />
          {STATUS_LABEL[phase]}
        </div>
        {recording ? (
          <div className="wall-status-timer">
            <div className="mirror-rec-indicator">
              <span className="mirror-rec-dot" />
              REC
            </div>
            <div className="wall-status-seconds">{Math.ceil(recordSecondsLeft)}</div>
          </div>
        ) : (
          <WallWaveform active={listening} />
        )}
        <div className="wall-status-tele">
          <span>MIC ARRAY · 4ch</span>
          <span>SNR 41.2 dB</span>
          <span>{listening ? 'VOICE GATE OPEN' : recording ? 'BUFFER WRITE' : 'IDLE'}</span>
        </div>
      </div>
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

const DIALOGUE_STATUS: Record<RevealDialogueState['phase'], string> = {
  idle: 'AWAITING APPOINTMENT',
  intro: 'MATCH CONTACT',
  listening: 'LISTENING',
  thinking: 'INDEXING',
  speaking: 'MATCH CONTACT',
  mirroring: 'IDENTITY CONVERGENCE',
  closing: 'CAPTURE COMPLETE',
  ended: 'SESSION ARCHIVED',
  error: 'VOICE LINK UNAVAILABLE',
}

function dialogueCopy(state: RevealDialogueState) {
  if (state.phase === 'idle') return 'Your appointment is being prepared.'
  if (state.phase === 'listening') return 'Speak. I am listening.'
  if (state.phase === 'thinking') return state.visitor_text || 'Comparing your answer.'
  if (state.phase === 'ended') return state.assistant_text || 'I will see you again soon.'
  if (state.phase === 'error') return 'The voice channel is unavailable.'
  return state.assistant_text || 'I have been waiting to meet you.'
}

function DialogueWallRoleContent({ role, state }: { role: WallRole; state: RevealDialogueState }) {
  const active = state.phase === 'listening' || state.phase === 'thinking'
  const mirroring =
    state.phase === 'mirroring' || state.phase === 'closing' || state.phase === 'ended'
  const archetypes = Object.entries(state.archetypes)

  if (role === 'copy') {
    return (
      <div className={`wall-role wall-role-copy wall-dialogue-copy phase-${state.phase}`}>
        <div className="wall-dialogue-kicker">{DIALOGUE_STATUS[state.phase]}</div>
        <p>{dialogueCopy(state)}</p>
        {state.phase === 'thinking' && state.visitor_text ? (
          <div className="wall-dialogue-transcript">VOICEPRINT: “{state.visitor_text}”</div>
        ) : null}
      </div>
    )
  }

  if (role === 'debra') {
    return (
      <div className={`wall-role wall-role-debra wall-dialogue-debra phase-${state.phase}`}>
        <div
          className="wall-debra-orb"
          style={{ transform: `scale(${1 + state.mirror_intensity * 0.13})` }}
        >
          <MirrorGuideOrb className="wall-debra-canvas" />
          <div className="wall-dialogue-orb-state">{DIALOGUE_STATUS[state.phase]}</div>
        </div>
      </div>
    )
  }

  if (role === 'status') {
    return (
      <div className="wall-role wall-role-status wall-dialogue-status">
        <WallParticleField count={28} active={active || mirroring} />
        <div className="wall-status-stack">
          <WallRadar active={active} />
          <div className="wall-status-label">
            <span className="mirror-status-marker" />
            {DIALOGUE_STATUS[state.phase]}
          </div>
          <WallWaveform active={state.phase === 'listening'} level={state.mic_level} />
          <div className="wall-status-tele">
            <span>INPUT · {state.audio_input || 'VOCAT USB ARRAY'}</span>
            <span>DETAILS ACQUIRED · {state.detail_count}</span>
            <span>CONVERGENCE · {Math.round(state.mirror_intensity * 100)}%</span>
          </div>
        </div>
      </div>
    )
  }

  if (role === 'code') {
    return (
      <div className="wall-role wall-role-code wall-dialogue-code">
        <CodePanel
          seed={state.turn + 1}
          blockCount={5}
          visibleRows={18}
          large
          big
          hasAlert={mirroring}
          duration={mirroring ? 4 : 8}
          style={{ inset: '3% 3% 24%' }}
        />
        <div className="wall-dialogue-ledger">
          <div>SUBJECT / {state.visit_id || 'PENDING'}</div>
          {state.details.slice(-5).map((detail) => (
            <div key={`${detail.key}-${detail.learned_turn}`}>
              <span>{detail.key}</span>
              {detail.value}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (role === 'avatar') {
    return (
      <div className="wall-role wall-role-avatar wall-dialogue-avatar">
        <WallParticleField count={44} active={mirroring} />
        <div className="wall-avatar-wait">
          <span className="wall-avatar-wait-mark" />
          {mirroring ? 'DUPLICATE FORMING' : 'AWAITING SUFFICIENT SIGNAL'}
          <strong>{Math.round(state.mirror_intensity * 100)}%</strong>
        </div>
      </div>
    )
  }

  return (
    <div className={`wall-role wall-role-guide${active || mirroring ? ' is-active' : ''}`}>
      <WallParticleField count={64} active={active || mirroring} />
      <div className="wall-dialogue-archetypes">
        <span>PERSONALITY COMPOSITE</span>
        {archetypes.map(([category, archetype]) => (
          <div key={category}>
            <small>{category}</small>
            {archetype}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ThirdStationWall({ role: roleProp }: { role?: WallRole }) {
  const role = roleProp ?? parseWallRole() ?? 'copy'
  const calibrate = parseWallCalibrate()
  const collage = parseWallCollage()
  const capture = parseWallCaptureParams()
  const isConductor = role === 'debra' && !calibrate && !capture
  const { phase, countdown, recordSecondsLeft, loadingProgress, photobashSeed, collageCue } =
    useWallSyncedPhase(isConductor)
  const dialogue = useRevealDialogue()
  const collageReady = useCollageBankReady(
    photobashSeed || 1,
    !shouldShowForming(loadingProgress),
    collageCue,
  )
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
    if (dialogue.available) document.documentElement.dataset.dialoguePhase = dialogue.state.phase
    else delete document.documentElement.dataset.dialoguePhase
    return () => {
      delete document.documentElement.dataset.dialoguePhase
    }
  }, [dialogue.available, dialogue.state.phase])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.style.setProperty('--mirror-bg-top', mirrorSettings.background.top)
    root.style.setProperty('--mirror-bg-bottom', mirrorSettings.background.bottom)
    root.style.setProperty('--mirror-accent', mirrorSettings.accent.color)
  }, [])

  const loadingSurface = pickWallLoadingSurface(collage, loadingProgress, collageReady)

  return (
    <section
      className={`third-station third-station-wall third-station-wall-${role}`}
      aria-label={`Mirror wall panel: ${role}`}
      ref={rootRef}
    >
      {calibrate ? <WallCalibrate role={role} /> : null}
      {calibrate ? null : capture ? (
        <WallCollageBlanket role={role} photobashSeed={capture.seed} collageCue={capture.cue} />
      ) : dialogueOwnsWall(dialogue.available, dialogue.state) ? (
        <DialogueWallRoleContent role={role} state={dialogue.state} />
      ) : phase === 'loading' ? (
        loadingSurface === 'forming' ? (
          <WallFormingBlanket
            role={role}
            photobashSeed={photobashSeed}
            loadingProgress={loadingProgress}
          />
        ) : loadingSurface === 'collage' ? (
          <WallCollageBlanket role={role} photobashSeed={photobashSeed} collageCue={collageCue} />
        ) : (
          <WallFaceBlanket role={role} photobashSeed={photobashSeed} />
        )
      ) : (
        <WallRoleContent
          role={role}
          phase={phase}
          countdown={countdown}
          recordSecondsLeft={recordSecondsLeft}
          loadingProgress={loadingProgress}
        />
      )}
      <RevealShellChrome />
    </section>
  )
}
