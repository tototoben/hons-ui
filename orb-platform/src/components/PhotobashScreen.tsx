import { useEffect } from 'react'
import { parseWallCollage, parseWallRole } from '../lib/wallRole'
import { usePhotobashLoop } from '../lib/wallPhaseSync'
import { WallCollageBlanket } from './WallCollageBlanket'
import { WallFaceBlanket } from './WallFaceBlanket'
import './DeviceUnlockLayer.css'

export function PhotobashScreen() {
  const role = parseWallRole()
  const collage = parseWallCollage()
  const isConductor = role === 'debra' || role === null
  const { photobashSeed } = usePhotobashLoop(isConductor)
  const crop = role ?? 'copy'

  useEffect(() => {
    document.documentElement.dataset.wallMode = 'true'
    document.documentElement.dataset.wallRole = crop
    return () => {
      delete document.documentElement.dataset.wallMode
      delete document.documentElement.dataset.wallRole
    }
  }, [crop])

  return (
    <section className="photobash-screen" aria-label="Photobash reveal">
      {collage ? (
        <WallCollageBlanket role={crop} photobashSeed={photobashSeed} />
      ) : (
        <WallFaceBlanket role={crop} photobashSeed={photobashSeed} />
      )}
    </section>
  )
}
