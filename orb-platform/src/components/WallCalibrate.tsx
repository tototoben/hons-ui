import { useEffect, useState, type CSSProperties } from 'react'
import { MEASURED_WALL_PANELS, type WallRole } from '../lib/wallRole'
import './WallCalibrate.css'

const ROLE_INK: Record<WallRole, string> = {
  code: '#ff5a3c',
  status: '#f0c14a',
  avatar: '#e45cff',
  debra: '#3ee0d4',
  copy: '#6adf63',
  guide: '#5aa8ff',
}

/**
 * Photogrammetry card for one wall display.
 * Shoot the whole wall with all six cards visible — role, grid, and live viewport
 * are unique enough to remap MEASURED_WALL_PANELS from a photo.
 */
export function WallCalibrate({ role }: { role: WallRole }) {
  const panel = MEASURED_WALL_PANELS.find((entry) => entry.role === role)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  }))

  useEffect(() => {
    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const portrait = viewport.height > viewport.width
  const cells = Array.from({ length: 16 }, (_, i) => i + 1)

  return (
    <div
      className="wall-cal"
      data-role={role}
      data-orientation={portrait ? 'portrait' : 'landscape'}
      style={{ '--wall-cal-ink': ROLE_INK[role] } as CSSProperties}
    >
      <span className="wall-cal-tick wall-cal-tick-tl" />
      <span className="wall-cal-tick wall-cal-tick-tr" />
      <span className="wall-cal-tick wall-cal-tick-bl" />
      <span className="wall-cal-tick wall-cal-tick-br" />

      <p className="wall-cal-kicker">WALL CAL · PHOTO THIS SCREEN</p>
      <h1 className="wall-cal-role">{role}</h1>
      <p className="wall-cal-meta">
        {portrait ? 'PORTRAIT' : 'LANDSCAPE'} · {viewport.width}×{viewport.height} · dpr{' '}
        {viewport.dpr.toFixed(2)}
      </p>
      <p className="wall-cal-meta">
        assumed {panel?.width}×{panel?.height} @ {panel?.x},{panel?.y} · {panel?.device}
      </p>

      <div className="wall-cal-grid" aria-hidden="true">
        {cells.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      <p className="wall-cal-foot">stand back · whole wall in one frame</p>
    </div>
  )
}
