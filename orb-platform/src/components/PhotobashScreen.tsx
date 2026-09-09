import { useEffect, useState } from 'react'
import { publish } from '../lib/firehose'
import { parseWallRole } from '../lib/wallRole'
import { usePhotobashLoop } from '../lib/wallPhaseSync'
import { photowallRuntimeStatus } from '../lib/stationStatus'
import { subscribePhotowallQueue } from '../lib/photowallQueue'
import { WallCollageBlanket } from './WallCollageBlanket'
import './DeviceUnlockLayer.css'

export function PhotobashScreen() {
  const role = parseWallRole()
  const isConductor = role === 'debra' || role === null
  const { photobashSeed, collageCue } = usePhotobashLoop(isConductor)
  const crop = role ?? 'copy'
  const [queueDetail, setQueueDetail] = useState(() => photowallRuntimeStatus().detail)

  useEffect(() => {
    return subscribePhotowallQueue(() => {
      setQueueDetail(photowallRuntimeStatus().detail)
    })
  }, [])

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
    publish('photobash', 'reveal')
  }, [isConductor])

  return (
    <section className="photobash-screen" aria-label="Photobash reveal">
      {isConductor ? (
        <div className="photobash-queue-status" aria-live="polite">
          {queueDetail}
        </div>
      ) : null}
      <WallCollageBlanket role={crop} photobashSeed={photobashSeed} collageCue={collageCue} />
    </section>
  )
}
