import { useEffect } from 'react'
import { useWallSyncedPhase } from '../lib/wallPhaseSync'
import { parseWallCalibrate, parseWallRole, type WallRole } from '../lib/wallRole'
import { WallCalibrate } from './WallCalibrate'
import { RevealShellChrome } from './RevealShellChrome'
import { WallCollageBlanket } from './WallCollageBlanket'
import './DeviceUnlockLayer.css'

/**
 * Backwards-compatible wall-role entry point.
 *
 * Tauri historically opened wall roles at `#/mirror`. Keep that URL safe by
 * making this wrapper photobash-only as well as the dedicated `#/photobash`
 * route. Calibration is the only intentional non-photobash exception.
 */
export function ThirdStationWall({ role: roleProp }: { role?: WallRole }) {
  const role = roleProp ?? parseWallRole() ?? 'copy'
  const calibrate = parseWallCalibrate()
  const isConductor = role === 'debra' && !calibrate
  const { photobashSeed, collageCue } = useWallSyncedPhase(isConductor)

  useEffect(() => {
    document.documentElement.dataset.wallMode = 'true'
    document.documentElement.dataset.wallRole = role
    return () => {
      delete document.documentElement.dataset.wallMode
      delete document.documentElement.dataset.wallRole
    }
  }, [role])

  return (
    <section
      className="photobash-screen photobash-wall"
      aria-label={`Photobash wall panel: ${role}`}
    >
      {calibrate ? (
        <WallCalibrate role={role} />
      ) : (
        <WallCollageBlanket role={role} photobashSeed={photobashSeed} collageCue={collageCue} />
      )}
      <RevealShellChrome />
    </section>
  )
}
