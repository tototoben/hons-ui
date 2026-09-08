export const INTRO_PROMPT_LINES = ['speak about', 'yourself'] as const

/** Last few wrapped lines for the Station III viewfinder caption. */
export function captionLines(text: string, maxLines = 3, width = 18): string[] {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return [...INTRO_PROMPT_LINES]

  const lines: string[] = []
  let current = ''
  for (const word of trimmed.split(' ')) {
    const next = current ? `${current} ${word}` : word
    if (current && next.length > width) {
      lines.push(current)
      current = word.length > width ? word.slice(0, width) : word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.slice(-maxLines)
}
