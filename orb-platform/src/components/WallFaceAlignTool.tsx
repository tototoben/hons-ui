import { useEffect, useState, type PointerEvent, type WheelEvent } from 'react'
import {
  composeWallMatchPhotobash,
  DEFAULT_VISITOR_ALIGN,
  getWallMatchShardCount,
  loadVisitorAlign,
  normalizeVisitorAlign,
  saveVisitorAlign,
  type VisitorAlign,
} from '../lib/wallMatchPhotobash'
import './WallFaceAlignTool.css'

type ViewMode = 'onion' | 'shards' | 'both'

/**
 * Manual lineup for visitor-face vs match-face.
 * Drag the preview to pan, scroll to scale, then Save for the wall photobash.
 */
export function WallFaceAlignTool() {
  const [align, setAlign] = useState<VisitorAlign>(() => loadVisitorAlign())
  const [onion, setOnion] = useState(0.45)
  const [mode, setMode] = useState<ViewMode>('both')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState('Drag to pan · scroll to scale')
  const [drag, setDrag] = useState<{ x: number; y: number; origin: VisitorAlign } | null>(null)

  useEffect(() => {
    let cancelled = false
    const shardCount = mode === 'onion' ? 0 : getWallMatchShardCount()
    const onionOpacity = mode === 'shards' ? 0 : onion
    composeWallMatchPhotobash({
      align,
      shardCount,
      onionOpacity,
      showShardGuides: mode !== 'shards',
    })
      .then((url) => {
        if (!cancelled) setPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled) setStatus('Failed to compose preview')
      })
    return () => {
      cancelled = true
    }
  }, [align, mode, onion])

  const update = (patch: Partial<VisitorAlign>) => {
    setAlign((prev) => normalizeVisitorAlign({ ...prev, ...patch }))
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ x: event.clientX, y: event.clientY, origin: align })
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const box = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - drag.x) / box.width
    const dy = (event.clientY - drag.y) / box.height
    update({
      offsetX: drag.origin.offsetX + dx,
      offsetY: drag.origin.offsetY + dy,
    })
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDrag(null)
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.04 : 0.04
    update({ scale: align.scale + delta })
  }

  const onSave = () => {
    const saved = saveVisitorAlign(align)
    setAlign(saved)
    setStatus('Saved — wall photobash will use this lineup on this browser')
  }

  const onCopy = async () => {
    const text = JSON.stringify(normalizeVisitorAlign(align), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Copied align JSON')
    } catch {
      setStatus(text)
    }
  }

  const onReset = () => {
    setAlign({ ...DEFAULT_VISITOR_ALIGN })
    setStatus('Reset to default lineup')
  }

  return (
    <div className="face-align">
      <header className="face-align-header">
        <div>
          <p className="face-align-kicker">Wall photobash</p>
          <h1>Line up faces</h1>
          <p className="face-align-copy">
            Nudge your photo over the match face. Red dashed outlines show the shard cuts. Save stores
            the lineup for this Chrome profile (wall windows pick it up).
          </p>
        </div>
        <div className="face-align-actions">
          <button type="button" onClick={onSave}>
            Save
          </button>
          <button type="button" className="is-ghost" onClick={onCopy}>
            Copy JSON
          </button>
          <button type="button" className="is-ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </header>

      <div className="face-align-layout">
        <div
          className={`face-align-stage${drag ? ' is-dragging' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Face align preview" draggable={false} />
          ) : (
            <p>Composing…</p>
          )}
        </div>

        <aside className="face-align-controls">
          <label>
            View
            <select value={mode} onChange={(e) => setMode(e.target.value as ViewMode)}>
              <option value="both">Onion + shards</option>
              <option value="onion">Onion skin only</option>
              <option value="shards">Shards only</option>
            </select>
          </label>

          <label>
            Onion opacity
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={onion}
              onChange={(e) => setOnion(Number(e.target.value))}
              disabled={mode === 'shards'}
            />
            <span>{Math.round(onion * 100)}%</span>
          </label>

          <label>
            Scale
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.01}
              value={align.scale}
              onChange={(e) => update({ scale: Number(e.target.value) })}
            />
            <span>{align.scale.toFixed(2)}</span>
          </label>

          <label>
            Offset X
            <input
              type="range"
              min={-0.45}
              max={0.45}
              step={0.005}
              value={align.offsetX}
              onChange={(e) => update({ offsetX: Number(e.target.value) })}
            />
            <span>{align.offsetX.toFixed(3)}</span>
          </label>

          <label>
            Offset Y
            <input
              type="range"
              min={-0.45}
              max={0.45}
              step={0.005}
              value={align.offsetY}
              onChange={(e) => update({ offsetY: Number(e.target.value) })}
            />
            <span>{align.offsetY.toFixed(3)}</span>
          </label>

          <p className="face-align-status" role="status">
            {status}
          </p>
          <pre className="face-align-json">{JSON.stringify(align, null, 2)}</pre>
        </aside>
      </div>
    </div>
  )
}
