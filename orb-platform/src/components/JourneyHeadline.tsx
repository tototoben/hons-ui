import { MirrorHeadline } from './MirrorHeadline'

export function JourneyHeadline({
  as: Tag = 'h1',
  children,
  lines,
  className,
  fontPx,
  fade = true,
}: {
  as?: 'h1' | 'span' | 'p'
  children: string
  lines: string[]
  className?: string
  fontPx?: number
  fade?: boolean
}) {
  const height = fontPx ? Math.ceil(fontPx * 1.2 * lines.length + 48) : undefined
  return (
    <Tag className={`journey-textured-headline${className ? ` ${className}` : ''}`}>
      <span className="journey-headline-copy">{children}</span>
      <span className="journey-headline-art" aria-hidden="true">
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
