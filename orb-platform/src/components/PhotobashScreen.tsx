import { useEffect, useRef } from 'react'
import { publish } from '../lib/firehose'
import { parseWallRole } from '../lib/wallRole'
import { usePhotobashLoop } from '../lib/wallPhaseSync'
import { WallCollageBlanket } from './WallCollageBlanket'
import './DeviceUnlockLayer.css'

export function PhotobashScreen() {
  const role = parseWallRole()
  const isConductor = role === 'debra' || role === null
  const { photobashSeed, collageCue } = usePhotobashLoop(isConductor)
  const crop = role ?? 'copy'
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
    if (lastCueRef.current === 'reveal') return
    lastCueRef.current = 'reveal'
    publish('photobash', 'reveal')
  }, [isConductor])

  return (
    <section className="photobash-screen" aria-label="Photobash reveal">
      <WallCollageBlanket role={crop} photobashSeed={photobashSeed} collageCue={collageCue} />
    </section>
  )
}
