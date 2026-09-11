import { useEffect, useMemo, useRef } from 'react'
import { dialogueOwnsWall, useRevealDialogue, type RevealDialogueState } from '../lib/revealDialogue'
import { parseWallCaptureParams } from '../lib/wallCapture'
import { useWallSyncedPhase } from '../lib/wallPhaseSync'
import { parseWallCalibrate, parseWallCollage, parseWallRole, type WallRole } from '../lib/wallRole'
import { RevealShellChrome } from './RevealShellChrome'
import { WallCalibrate } from './WallCalibrate'
import { CodePanel } from './HudDebris'
import { MirrorGuideOrb } from './MirrorGuideOrb'
import { WallFaceBlanket } from './WallFaceBlanket'
import { WallCollageBlanket } from './WallCollageBlanket'
import { WallFormingBlanket } from './WallFormingBlanket'
import { useCollageBankReady } from '../lib/wallCollageBank'
import { pickWallLoadingSurface, shouldShowForming } from '../lib/wallForming'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import './ThirdStation.css'
import './ThirdStationWall.css'

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
  // countdown / recordSecondsLeft existed only for the removed narrative
  // panels; the wall renders the collage instead.
  const { phase, loadingProgress, photobashSeed, collageCue } =
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
        // The wall always shows the collage. The intro/prompt/recording
        // narrative panels (STANDBY / LISTENING / RECORDING) were removed
        // deliberately in f05eebc and 4613d4d and must not come back -- a
        // merge resurrected them once already. Anything that is not a
        // calibration, a headless capture or a live dialogue renders the
        // photobash.
        <WallCollageBlanket role={role} photobashSeed={photobashSeed} collageCue={collageCue} />
      )}
      <RevealShellChrome />
    </section>
  )
}
