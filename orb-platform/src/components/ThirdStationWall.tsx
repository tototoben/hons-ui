import { useEffect, useRef } from 'react'
import { useWallSyncedPhase } from '../lib/wallPhaseSync'
import { parseWallCalibrate, parseWallRole, type WallRole } from '../lib/wallRole'
import { RevealShellChrome } from './RevealShellChrome'
import { WallCalibrate } from './WallCalibrate'
import { WallCollageBlanket } from './WallCollageBlanket'
import { mirrorSettings } from '../dev/mirrorSettingsStore'
import './ThirdStation.css'
import './ThirdStationWall.css'

export function ThirdStationWall({ role: roleProp }: { role?: WallRole }) {
  const role = roleProp ?? parseWallRole() ?? 'copy'
  const calibrate = parseWallCalibrate()
  const isConductor = role === 'debra' && !calibrate
  const { photobashSeed, collageCue } = useWallSyncedPhase(isConductor)
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
      {calibrate ? null : (
        // The wall reveal is photobash only -- "introduce yourself" etc. is
        // Station 3's own kiosk job, not replayed here. Always show the
        // collage, regardless of Station 3's own intro/prompt/recording
        // phase, matching PhotobashScreen's always-cycling approach.
        <WallCollageBlanket role={role} photobashSeed={photobashSeed} collageCue={collageCue} />
      )}
      <RevealShellChrome />
    </section>
  )
}
