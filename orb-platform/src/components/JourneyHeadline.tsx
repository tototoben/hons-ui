import {
  HEADLINE_CANVAS_WIDTH,
  headlineFirstLineFromBottom,
  MirrorHeadline,
} from './MirrorHeadline'

/** Lines a bottom-anchored message is laid out for. */
const ANCHOR_LINES = 2

/**
 * Bottom-anchored copy grows upward as lines are added. With `growDown`,
 * copy longer than two lines is pulled down so its first line sits where a
 * two-line headline's first line does. The canvas scales with the column
 * width, and percentage margins resolve against width, so a % offset holds
 * at every screen size.
 */
function growDownMargin(lineCount: number): string | undefined {
  if (lineCount <= ANCHOR_LINES) return undefined
  const shift = headlineFirstLineFromBottom(lineCount) - headlineFirstLineFromBottom(ANCHOR_LINES)
  return shift > 0 ? `${(-shift / HEADLINE_CANVAS_WIDTH) * 100}%` : undefined
}

export function JourneyHeadline({
  as: Tag = 'h1',
  children,
  lines,
  className,
  fontPx,
  fade = true,
  growDown = false,
}: {
  as?: 'h1' | 'span' | 'p'
  children: string
  lines: string[]
  className?: string
  fontPx?: number
  fade?: boolean
  growDown?: boolean
}) {
  const height = fontPx ? Math.ceil(fontPx * 1.2 * lines.length + 48) : undefined
  return (
    <Tag className={`journey-textured-headline${className ? ` ${className}` : ''}`}>
      <span className="journey-headline-copy">{children}</span>
      <span
        className="journey-headline-art"
        aria-hidden="true"
        style={growDown && !fontPx ? { marginBottom: growDownMargin(lines.length) } : undefined}
      >
        <MirrorHeadline
          lines={lines}
          fontPx={fontPx}
          height={height}
          fade={fade}
          className="journey-headline-canvas"
        />
      </span>
    </Tag>
  )
}
