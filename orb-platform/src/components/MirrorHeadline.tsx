import { useEffect, useMemo, useRef } from 'react'
import { useStationVibe } from '../hooks/useStationVibe'
import { isKioskQuality } from '../lib/deviceQuality'
import { drawGrainyText } from '../lib/grainyText'
import { mirrorSettings } from '../dev/mirrorSettingsStore'

const REDRAW_INTERVAL_MS = 1000 / 8
const FADE_IN_MS = 900

/**
 * DOM-canvas headline text using the same drawGrainyText treatment as the
 * Orb station's QuestionPrompt (crisp base + drifting smudge layer) — the
 * "same text styles as before" the Mirror station's copy should carry.
 * Plain <canvas> rather than a 3D mesh/texture since this station is a
 * flat screen-space UI, not a room you're looking into.
 *
 * Kiosk keeps the haze (it is the look) but paints it once instead of
 * drifting at 8 fps — the wet overlay still reads, without a redraw loop.
 */
export function MirrorHeadline({
  lines,
  className,
  fontPx,
  width = 1000,
  height = 340,
  fade = true,
  align = 'center',
}: {
  lines: string[]
  className?: string
  fontPx?: number
  width?: number
  height?: number
  fade?: boolean
  align?: CanvasTextAlign
}) {
  const [vibe] = useStationVibe()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const text = useMemo(
    () => (vibe === 'original' ? lines.join('\n').toUpperCase() : lines.join('\n')),
    [lines, vibe],
  )
  const fadeIn = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    fadeIn.current = fade ? 0 : 1
    canvas.style.opacity = fade ? '0' : '1'
    const start = performance.now()
    const parts = text.split('\n')
    const s = mirrorSettings.text
    const size = fontPx ?? s.fontPx
    const scale = size / s.fontPx
    const kiosk = isKioskQuality()

    const paint = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      const lineHeight = size * 1.08
      const totalHeight = lineHeight * parts.length
      const startY = height / 2 - totalHeight / 2 + lineHeight / 2
      parts.forEach((line, i) => {
        const lineCanvas = document.createElement('canvas')
        lineCanvas.width = width
        lineCanvas.height = Math.max(1, Math.ceil(lineHeight))
        const lctx = lineCanvas.getContext('2d')!
        drawGrainyText(lctx, lineCanvas, line, {
          fontPx: size,
          weight: 350,
          maxWidthPx: width * 0.94,
          textAlign: align,
          shade: 200,
          shadeVariance: 40,
          color: hexToRgbUnit(s.color),
          smudgeColor: hexToRgbUnit(s.smudgeColor),
          crispAlpha: s.crispAlpha,
          smudgeAlpha: s.smudgeAlpha,
          smudgeWeight: s.smudgeWeight,
          smudgeBoost: s.smudgeBoost,
          smudgeBlurPx: Math.max(2.2, s.smudgeBlurPx * scale),
          smudgeCellsX: 10,
          smudgeCellsY: 3,
          smudgeContrast: s.smudgeContrast,
          smudgeFloor: s.smudgeFloor,
          smudgeDriftTime: t,
          smudgeDriftPeriod: kiosk ? 0 : s.driftPeriod,
          grain: s.grain,
          edgeFade: s.edgeFade,
        })
        ctx.drawImage(lineCanvas, 0, startY + i * lineHeight - lineHeight / 2)
      })
    }

    if (kiosk || !fade) {
      paint(0)
      if (fade) {
        canvas.style.transition = `opacity ${FADE_IN_MS}ms linear`
        requestAnimationFrame(() => {
          canvas.style.opacity = '1'
        })
      }
      return
    }

    let raf = 0
    let lastDraw = -1

    const draw = (now: number) => {
      const t = (now - start) / 1000
      fadeIn.current = Math.min(1, (now - start) / FADE_IN_MS)
      canvas.style.opacity = String(fadeIn.current)

      if (lastDraw < 0 || now - lastDraw >= REDRAW_INTERVAL_MS) {
        lastDraw = now
        paint(t)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [align, fade, fontPx, height, text, width])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={width}
      height={height}
      style={{ transition: fade ? 'opacity 0.2s linear' : 'none' }}
    />
  )
}

function hexToRgbUnit(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}
