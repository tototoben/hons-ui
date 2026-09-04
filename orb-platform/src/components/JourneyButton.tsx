import {
  useEffect,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react'
import { useStationVibe } from '../hooks/useStationVibe'
import { canvasPixelRatio } from '../lib/deviceQuality'
import { drawGrainyText } from '../lib/grainyText'
import { mirrorSettings } from '../dev/mirrorSettingsStore'

type SharedProps = {
  children: string
  className?: string
}

type ButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & {
    as?: 'button'
  }

type LinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'className'> & {
    as: 'a'
  }

/**
 * Station I/II control: crisp label at rest, the same grainy ice haze as
 * the headlines on hover/focus/press. Semantic copy stays in the DOM.
 */
export function JourneyButton(props: ButtonProps | LinkProps) {
  const { children, className, as: Tag = 'button', ...rest } = props
  const [vibe] = useStationVibe()
  const hostRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const paint = () => {
      const dpr = Math.max(1, canvasPixelRatio())
      const w = Math.max(2, Math.round(host.clientWidth * dpr))
      const h = Math.max(2, Math.round(host.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const styles = getComputedStyle(host)
      const fontPx = Math.max(22, Math.round(parseFloat(styles.fontSize) * dpr * 1.7))
      const scale = fontPx / mirrorSettings.text.fontPx
      const ice = readCssColor('--mirror-ice', '#b9dceb')
      const ink = readCssColor('--mirror-ink', '#f4f6f5')
      const label = vibe === 'original' ? children.toUpperCase() : children
      ctx.clearRect(0, 0, w, h)
      drawGrainyText(ctx, canvas, label, {
        fontPx,
        weight: 500,
        maxWidthPx: w * 0.92,
        shade: 220,
        shadeVariance: 36,
        color: hexToRgbUnit(ink),
        smudgeColor: hexToRgbUnit(ice),
        crispAlpha: 0.88,
        smudgeAlpha: 0.92,
        smudgeWeight: mirrorSettings.text.smudgeWeight,
        smudgeBoost: Math.max(mirrorSettings.text.smudgeBoost, 3),
        smudgeBlurPx: Math.max(5.5, mirrorSettings.text.smudgeBlurPx * scale * 1.45),
        smudgeCellsX: 8,
        smudgeCellsY: 3,
        smudgeContrast: mirrorSettings.text.smudgeContrast,
        smudgeFloor: Math.max(mirrorSettings.text.smudgeFloor, 0.22),
        smudgeDriftTime: 0,
        smudgeDriftPeriod: 0,
        grain: mirrorSettings.text.grain,
        edgeFade: 0.08,
      })
    }

    paint()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(paint)
    observer.observe(host)
    return () => observer.disconnect()
  }, [children, vibe])

  const classNames = `journey-action${className ? ` ${className}` : ''}`
  const content: ReactNode = (
    <>
      <span className="journey-action-copy">{children}</span>
      <span className="journey-action-haze" aria-hidden="true">
        <canvas ref={canvasRef} />
      </span>
    </>
  )

  if (Tag === 'a') {
    const linkProps = rest as Omit<LinkProps, 'as' | 'children' | 'className'>
    return (
      <a
        {...linkProps}
        className={classNames}
        ref={hostRef as Ref<HTMLAnchorElement>}
      >
        {content}
      </a>
    )
  }

  const buttonProps = rest as Omit<ButtonProps, 'as' | 'children' | 'className'>
  return (
    <button
      {...buttonProps}
      className={classNames}
      ref={hostRef as Ref<HTMLButtonElement>}
    >
      {content}
    </button>
  )
}

function readCssColor(name: string, fallback: string) {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function hexToRgbUnit(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}
