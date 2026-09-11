import { useEffect, useRef } from 'react'
import { dialogueOwnsWall, useRevealDialogue, type RevealDialogueState } from '../lib/revealDialogue'
import { parseWallCaptureParams } from '../lib/wallCapture'
import { useWallSyncedPhase } from '../lib/wallPhaseSync'
import { parseWallCalibrate, parseWallCollage, parseWallRole, type WallRole } from '../lib/wallRole'
import { RevealShellChrome } from './RevealShellChrome'
import { WallCalibrate } from './WallCalibrate'
import { MirrorGuideOrb } from './MirrorGuideOrb'
import { WallFaceBlanket } from './WallFaceBlanket'
import { WallCollageBlanket } from './WallCollageBlanket'
import { WallFormingBlanket } from './WallFormingBlanket'
import { useCollageBankReady } from '../lib/wallCollageBank'
import { pickWallLoadingSurface, shouldShowForming } from '../lib/wallForming'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import './ThirdStation.css'
import './ThirdStationWall.css'

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

/** Stable collage seed for a reveal visit: every panel hashes the same
 * visit_id from the shared SSE state, so all six derive the same collage for
 * the same visitor without any cross-window coordination. */
function seedFromVisitId(visitId: string | null): number | null {
  if (!visitId) return null
  let h = 2166136261
  for (let i = 0; i < visitId.length; i++) {
    h ^= visitId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 1_000_000_000 || 1
}

function DialogueWallRoleContent({ role, state }: { role: WallRole; state: RevealDialogueState }) {
  // Only the dialogue monitor renders this; every other panel shows the
  // visitor's photobash while the dialogue runs. The status-chrome variants
  // this function used to carry for the other five roles (radar, particle
  // fields, code ledger) read as loading screens and were removed.
  void role
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
        // During the dialogue: the dialogue monitor keeps the speaking
        // presence; every other panel shows the visitor's photobash, its
        // mouth driven by the live speech level. No status chrome.
        role === 'debra' ? (
          <DialogueWallRoleContent role={role} state={dialogue.state} />
        ) : (
          <WallCollageBlanket
            role={role}
            photobashSeed={seedFromVisitId(dialogue.state.visit_id) ?? (photobashSeed || 1)}
            collageCue={collageCue}
            dialogue={dialogue.state}
          />
        )
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
