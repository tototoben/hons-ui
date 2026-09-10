import { useEffect, useRef, useState } from 'react'
import { loadFaceBankEntries, type FaceBankEntry } from '../lib/faceBank'
import {
  computeFaceAlign,
  detectFaceLandmarks,
  TARGET_LEFT_EYE,
  TARGET_RIGHT_EYE,
} from '../lib/faceBankAlign'
import {
  DEFAULT_VISITOR_ALIGN,
  drawVisitorAligned,
  MATCH_FACE_SIZE,
  type VisitorAlign,
} from '../lib/wallMatchPhotobash'

const PLATE_RATIO = MATCH_FACE_SIZE.width / MATCH_FACE_SIZE.height
const W = 240
const H = Math.round(W / PLATE_RATIO)

type Row = { entry: FaceBankEntry; align: VisitorAlign; isDefault: boolean }

/**
 * Face-centered square recrop: bounding box of every detected landmark
 * (not just eyes), padded, forced square, clamped to the source image.
 * Writing to disk happens on a local receiver -- this only computes pixels.
 */
async function recropToDataUrl(image: HTMLImageElement, outSize = 640): Promise<string | null> {
  const landmarks = await detectFaceLandmarks(image)
  if (!landmarks || landmarks.length === 0) return null
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const p of landmarks) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  // Face-oval landmarks hug the jaw/hairline; pad so hair + a little chin
  // room survives (matches the synthetic bank photos' framing), lean the
  // pad upward since foreheads/hair need more room than chin.
  const bw = (maxX - minX) * sourceWidth
  const bh = (maxY - minY) * sourceHeight
  const cx = ((minX + maxX) / 2) * sourceWidth
  const cy = ((minY + maxY) / 2) * sourceHeight
  const padW = bw * 0.7
  const padH = bh * 0.55
  const side = Math.max(bw + padW * 2, bh + padH * 2)
  let sx = cx - side / 2
  let sy = cy - side / 2 - bh * 0.12 // bias up: more forehead/hair, less neck
  let sw = side
  let sh = side
  // Clamp into the source image without changing aspect (shrink if needed).
  if (sx < 0) sx = 0
  if (sy < 0) sy = 0
  if (sx + sw > sourceWidth) sw = sourceWidth - sx
  if (sy + sh > sourceHeight) sh = sourceHeight - sy
  const clampedSide = Math.min(sw, sh)
  sw = clampedSide
  sh = clampedSide

  const canvas = document.createElement('canvas')
  canvas.width = outSize
  canvas.height = outSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outSize, outSize)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export async function postCrop(file: string, dataUrl: string): Promise<boolean> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const resp = await fetch(`http://b310-mac:8099/save?file=${encodeURIComponent(file)}`, {
    method: 'POST',
    body: blob,
  })
  return resp.ok
}

function Card({ row }: { row: Row }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    drawVisitorAligned(ctx, row.entry.image, W, H, row.align)
    ctx.save()
    ctx.strokeStyle = row.isDefault ? 'rgba(255,60,60,0.9)' : 'rgba(60,255,120,0.9)'
    ctx.lineWidth = 1.5
    for (const eye of [TARGET_LEFT_EYE, TARGET_RIGHT_EYE]) {
      const x = eye.x * W
      const y = eye.y * H
      ctx.beginPath()
      ctx.moveTo(x - 6, y)
      ctx.lineTo(x + 6, y)
      ctx.moveTo(x, y - 6)
      ctx.lineTo(x, y + 6)
      ctx.stroke()
    }
    ctx.restore()
  }, [row])
  const scaleFlag = Math.abs(row.align.scale - 1) > 0.15
  return (
    <div style={{ border: row.isDefault ? '2px solid #f33' : scaleFlag ? '2px solid #fa3' : '1px solid #444', padding: 6 }}>
      <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', width: W, height: H }} />
      <div style={{ fontSize: 11, color: '#ccc', marginTop: 4, fontFamily: 'monospace' }}>
        {row.entry.face.file}
        <br />
        scale={row.align.scale.toFixed(3)} ox={row.align.offsetX.toFixed(3)} oy={row.align.offsetY.toFixed(3)}
        {row.isDefault ? <><br /><b style={{ color: '#f66' }}>FELL BACK TO DEFAULT (no face detected)</b></> : null}
      </div>
    </div>
  )
}

export function FaceBankAudit() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [progress, setProgress] = useState(0)
  const entriesRef = useRef<FaceBankEntry[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const entries = await loadFaceBankEntries()
      entriesRef.current = entries
      const out: Row[] = []
      for (const entry of entries) {
        const align = await computeFaceAlign(entry.image, PLATE_RATIO)
        const isDefault =
          align.scale === DEFAULT_VISITOR_ALIGN.scale &&
          align.offsetX === DEFAULT_VISITOR_ALIGN.offsetX &&
          align.offsetY === DEFAULT_VISITOR_ALIGN.offsetY
        out.push({ entry, align, isDefault })
        if (!cancelled) {
          setProgress(out.length)
          setRows([...out])
        }
      }
      ;(window as unknown as { __audit: unknown }).__audit = {
        entries,
        // The receiver on :8099 isn't reachable from this browser context --
        // return data URLs directly so the caller can save them another way.
        recropAll: async (files: string[]) => {
          const out: Record<string, string | null> = {}
          for (const file of files) {
            const entry = entries.find((e) => e.face.file === file)
            out[file] = entry ? await recropToDataUrl(entry.image) : null
          }
          return out
        },
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div style={{ background: '#111', minHeight: '100vh', padding: 16, color: '#eee' }}>
      <h1 style={{ fontFamily: 'monospace', fontSize: 16 }}>
        Face-bank alignment audit -- {progress}/{rows?.length ?? '?'} processed. Green crosshair = real
        detection, red border = fell back to default, amber border = scale far from 1 (loose/tight source crop).
      </h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {rows?.map((row) => <Card key={row.entry.face.file} row={row} />)}
      </div>
    </div>
  )
}
