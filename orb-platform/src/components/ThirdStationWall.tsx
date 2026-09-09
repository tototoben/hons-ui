import { useEffect, useRef } from 'react'
import { usePhotobashLoop } from '../lib/wallPhaseSync'
import { parseWallCalibrate, parseWallRole, type WallRole } from '../lib/wallRole'
import { parseCollageCue, type CollageCue } from '../lib/collageCue'
import { RevealShellChrome } from './RevealShellChrome'
import { WallCalibrate } from './WallCalibrate'
import { WallCollageBlanket } from './WallCollageBlanket'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import './ThirdStation.css'
import './ThirdStationWall.css'

/** Direct-render override for the headless-Chrome memorabilia capture --
 * a fresh page load has no live reveal state (BroadcastChannel history,
 * Central poll) to draw on, so the capture script passes the exact
 * seed/cue it wants rendered and skips the live gating entirely. Never
 * used by the real installation windows. */
function parseCaptureParams(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): { seed: number; cue: CollageCue } | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const rawSeed = params.get('captureSeed')
  if (!rawSeed) return null
  const seed = Number(rawSeed)
  if (!Number.isFinite(seed) || seed <= 0) return null
  const rawCue = params.get('captureCue')
  let cue: CollageCue = {}
  if (rawCue) {
    try {
      cue = parseCollageCue(JSON.parse(decodeURIComponent(rawCue)))
    } catch {
      cue = {}
    }
  }
  return { seed, cue }
}

export function ThirdStationWall({ role: roleProp }: { role?: WallRole }) {
  const role = roleProp ?? parseWallRole() ?? 'copy'
  const calibrate = parseWallCalibrate()
  const capture = parseCaptureParams()
  const isConductor = role === 'debra' && !calibrate && !capture
  const live = usePhotobashLoop(isConductor)
  const photobashSeed = capture?.seed ?? live.photobashSeed
  const collageCue = capture?.cue ?? live.collageCue
  const hasRevealed = capture !== null || live.hasRevealed
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
      {calibrate ? <WallCalibrate role={role} /> : null}
      {calibrate || !hasRevealed ? null : (
        // The wall reveal is photobash only -- "introduce yourself" etc. is
        // Station 3's own kiosk job, not replayed here. Once a visitor has
        // actually finished Station 3 (hasRevealed), always show the
        // collage regardless of Station 3's own intro/prompt/recording
        // phase. Before that, stay blank -- no visitor, no photobash.
        // DO NOT reintroduce the old intro/prompt/recording narrative
        // panels (WallCodePanel/WallStatusPanel/etc.) here -- removed
        // deliberately, see commit history.
        <WallCollageBlanket
          role={role}
          photobashSeed={photobashSeed}
          collageCue={collageCue}
          staticCapture={capture !== null}
        />
      )}
      <RevealShellChrome />
    </section>
  )
}
