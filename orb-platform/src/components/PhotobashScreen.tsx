import { useEffect, useRef } from 'react'
import { publish } from '../lib/firehose'
import { parseWallCollage, parseWallRole } from '../lib/wallRole'
import { usePhotobashLoop } from '../lib/wallPhaseSync'
import { useCollageBankReady } from '../lib/wallCollageBank'
import { pickWallLoadingSurface, shouldShowForming } from '../lib/wallForming'
import { PhotobashVoice } from './PhotobashVoice'
import { WallCollageBlanket } from './WallCollageBlanket'
import { WallFaceBlanket } from './WallFaceBlanket'
import { WallFormingBlanket } from './WallFormingBlanket'
import './DeviceUnlockLayer.css'

export function PhotobashScreen() {
  const role = parseWallRole()
  const collage = parseWallCollage()
  const isConductor = role === 'debra' || role === null
  const { photobashSeed, loadingProgress, cycleKey } = usePhotobashLoop(isConductor)
  const crop = role ?? 'copy'
  const collageReady = useCollageBankReady(photobashSeed || 1, !shouldShowForming(loadingProgress))
  const surface = pickWallLoadingSurface(collage, loadingProgress, collageReady)
  const forming = surface === 'forming'
  const lastCueRef = useRef<string | null>(null)

  useEffect(() => {
    document.documentElement.dataset.wallMode = 'true'
    document.documentElement.dataset.wallRole = crop
    return () => {
      delete document.documentElement.dataset.wallMode
      delete document.documentElement.dataset.wallRole
    }
  }, [crop])

  useEffect(() => {
    if (!isConductor) return
    const event = forming ? 'forming' : 'reveal'
    if (lastCueRef.current === event) return
    lastCueRef.current = event
    publish('photobash', event)
  }, [forming, isConductor])

  return (
    <section className="photobash-screen" aria-label="Photobash reveal">
      {isConductor ? <PhotobashVoice cycleKey={cycleKey} loadingProgress={loadingProgress} /> : null}
      {surface === 'forming' ? (
        <WallFormingBlanket
          role={crop}
          photobashSeed={photobashSeed}
          loadingProgress={loadingProgress}
        />
      ) : surface === 'collage' ? (
        <WallCollageBlanket role={crop} photobashSeed={photobashSeed} />
      ) : (
        <WallFaceBlanket role={crop} photobashSeed={photobashSeed} />
      )}
    </section>
  )
}
