import { useEffect, useRef } from 'react'
import { UNLOCK_CORNER_PX, UNLOCK_HOLD_MS, UNLOCK_KEY } from '../lib/deviceLock'
import './DeviceUnlockLayer.css'

export function DeviceUnlockLayer({ onUnlock }: { onUnlock: () => void }) {
  const holdRef = useRef(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== UNLOCK_KEY) return
      const target = document.activeElement
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (typing) return
      onUnlock()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onUnlock])

  const cancelHold = () => {
    window.clearTimeout(holdRef.current)
    holdRef.current = 0
  }

  return (
    <div
      data-unlock-corner
      className="device-unlock-corner"
      style={{ width: UNLOCK_CORNER_PX, height: UNLOCK_CORNER_PX }}
      onPointerDown={() => {
        cancelHold()
        holdRef.current = window.setTimeout(onUnlock, UNLOCK_HOLD_MS)
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
    />
  )
}
