import type { CollageCue } from './collageCue'
import type { ActiveVisit } from './visitCentral'
import { stationOnePayload } from './visitCentral'

export type WallSouvenirTicketInput = {
  visitId?: string | null
  photobashSeed: number
  collageCue?: CollageCue
  visit?: ActiveVisit | null
}

export type WallTicketSlotRole = 'title' | 'meta' | 'detail' | 'spine' | 'footer' | 'forehead'

export type WallTicketTextSlot = {
  role: WallTicketSlotRole
  x: number
  y: number
  w: number
  h: number
  align: CanvasTextAlign
  /** Degrees clockwise; 90 reads upward on the right edge, -90 reads downward on the left. */
  rotate?: 0 | 90 | -90
  size: number
  weight?: number
  /** stack = one fragment per line along the long axis; scatter = spread along the short axis */
  mode: 'stack' | 'scatter'
}

export type WallTicketFragment = {
  role: WallTicketSlotRole
  text: string
}

const TITLE = 'HOUSE OF NEGOTIATED SELVES'
/** Offline placeholders; live tickets use station I `callName`. */
export const PLACEHOLDER_CALL_NAME = 'Morgan'

export function visitorCallName(input: WallSouvenirTicketInput): string {
  const one = stationOnePayload(input.visit ?? null)
  const raw = one?.answers?.callName?.trim() ?? ''
  return raw || PLACEHOLDER_CALL_NAME
}

export function perfectPartnerCaption(input: WallSouvenirTicketInput): string {
  return `${visitorCallName(input)}'s perfect partner`
}

export function visitorNumberFromSeed(seed: number): string {
  const n = (Math.abs(seed) % 900) + 100
  return `Visitor no. ${n}`
}

export function shortVisitLabel(visitId: string): string {
  const tail = visitId.replace(/^v-/, '').slice(0, 8)
  return `Visit ${tail}`
}

function vagueIdentity(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  if (text.length <= 24) return text
  return `${text.slice(0, 21)}…`
}

function formatDateStamp(): string {
  try {
    return new Date().toISOString().slice(0, 10)
  } catch {
    return 'archive'
  }
}

/** Fragmented caption pieces mapped to white-gap slots (rotation handled at draw time). */
export function buildWallSouvenirTicketFragments(input: WallSouvenirTicketInput): WallTicketFragment[] {
  const one = stationOnePayload(input.visit ?? null)
  const answers = one?.answers ?? {}
  const cue = input.collageCue ?? {}
  const identity = vagueIdentity(String(answers.identity ?? ''))
  const fragments: WallTicketFragment[] = []

  for (const word of TITLE.split(/\s+/)) {
    fragments.push({ role: 'title', text: word })
  }

  if (input.visitId) fragments.push({ role: 'meta', text: shortVisitLabel(input.visitId) })
  else fragments.push({ role: 'meta', text: visitorNumberFromSeed(input.photobashSeed) })
  fragments.push({ role: 'meta', text: formatDateStamp() })

  fragments.push({ role: 'detail', text: perfectPartnerCaption(input) })

  if (identity) fragments.push({ role: 'spine', text: identity })
  fragments.push({ role: 'spine', text: 'negotiated' })
  fragments.push({ role: 'spine', text: 'selves' })

  if (cue.smile === true) fragments.push({ role: 'forehead', text: 'smile' })
  if (cue.smile === false) fragments.push({ role: 'forehead', text: 'resting' })

  fragments.push({ role: 'footer', text: 'archived copy' })

  return fragments
}

/** Caption lines for the souvenir strip — vague when data is missing. */
export function buildWallSouvenirTicketLines(input: WallSouvenirTicketInput): string[] {
  const lines: string[] = [TITLE]

  if (input.visitId) {
    lines.push(shortVisitLabel(input.visitId))
  } else {
    lines.push(visitorNumberFromSeed(input.photobashSeed))
  }

  lines.push(perfectPartnerCaption(input))
  lines.push(formatDateStamp())
  lines.push('archived copy')

  return lines
}

export function wallSouvenirTicketInputFromVisit(
  visit: ActiveVisit | null,
  opts: { visitId?: string | null; photobashSeed: number; collageCue?: CollageCue },
): WallSouvenirTicketInput {
  return {
    visitId: opts.visitId ?? visit?.visit_id ?? null,
    photobashSeed: opts.photobashSeed,
    collageCue: opts.collageCue,
    visit,
  }
}

function fontForSize(size: number, weight: number) {
  // node-canvas resolves system-ui to a ~10px fallback inside clip+rotate; use sans-serif.
  return `${weight} ${size}px Helvetica, Arial, sans-serif`
}

function fontForSlot(slot: WallTicketTextSlot, scale: number) {
  const size = Math.round(slot.size * scale)
  return fontForSize(size, slot.weight ?? 600)
}

function fitStackedFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  slot: WallTicketTextSlot,
  scale: number,
  maxWidth: number,
): number {
  const weight = slot.weight ?? 600
  let size = Math.round(slot.size * scale)
  while (size >= 28) {
    ctx.font = fontForSize(size, weight)
    const width = ctx.measureText(text).width
    const lines = wrapLine(ctx, text, maxWidth)
    const tooWide =
      width > maxWidth || lines.some((line) => ctx.measureText(line).width > maxWidth)
    if (!tooWide) return size
    size -= 2
  }
  return 28
}

function drawStacked(
  ctx: CanvasRenderingContext2D,
  slot: WallTicketTextSlot,
  fragments: string[],
  scale: number,
) {
  const pad = Math.round(14 * scale)
  const gap = Math.round(18 * scale)
  const rotate = slot.rotate ?? 0

  if (rotate === 0) {
    const maxWidth = slot.w - pad * 2
    const blocks = fragments.map((text) => {
      const fontSize = fitStackedFontSize(ctx, text, slot, scale, maxWidth)
      ctx.font = fontForSize(fontSize, slot.weight ?? 600)
      const lines = wrapLine(ctx, text, maxWidth)
      const lineHeight = Math.round(fontSize * 1.08) + gap
      const blockHeight =
        lines.length > 0 ? fontSize + (lines.length - 1) * lineHeight : 0
      return { text, fontSize, lines, lineHeight, blockHeight }
    })
    const totalHeight = blocks.reduce((sum, block) => sum + block.blockHeight, 0)
    let y =
      slot.align === 'center'
        ? slot.y + Math.max(pad, (slot.h - totalHeight) / 2)
        : slot.y + pad
    for (const block of blocks) {
      ctx.font = fontForSize(block.fontSize, slot.weight ?? 600)
      ctx.fillStyle = '#141414'
      ctx.textAlign = slot.align
      ctx.textBaseline = 'top'
      let x = slot.x + pad
      if (slot.align === 'center') x = slot.x + slot.w / 2
      if (slot.align === 'right') x = slot.x + slot.w - pad
      for (const line of block.lines) {
        if (y + block.fontSize > slot.y + slot.h) return
        ctx.fillText(line, x, y)
        y += block.lineHeight
      }
    }
    return
  }

  const originX = rotate === 90 ? slot.x + slot.w : slot.x
  const originY = rotate === 90 ? slot.y : slot.y + slot.h
  ctx.translate(originX, originY)
  ctx.rotate((rotate * Math.PI) / 180)

  const along = slot.h
  let cursor = pad
  for (const text of fragments) {
    ctx.font = fontForSlot(slot, scale)
    ctx.fillStyle = '#141414'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const width = ctx.measureText(text).width
    if (cursor + width > along - pad) break
    ctx.fillText(text, cursor, pad)
    cursor += width + gap
  }
}

function drawScattered(
  ctx: CanvasRenderingContext2D,
  slot: WallTicketTextSlot,
  fragments: string[],
  scale: number,
) {
  const pad = Math.round(16 * scale)
  const gap = Math.round(28 * scale)
  ctx.font = fontForSlot(slot, scale)
  ctx.fillStyle = '#141414'
  ctx.textBaseline = 'middle'

  const widths = fragments.map((text) => ctx.measureText(text).width)
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, fragments.length - 1)
  let x =
    slot.align === 'center'
      ? slot.x + (slot.w - total) / 2
      : slot.align === 'right'
        ? slot.x + slot.w - total - pad
        : slot.x + pad
  const y = slot.y + slot.h / 2

  for (let i = 0; i < fragments.length; i += 1) {
    if (x + widths[i] > slot.x + slot.w - pad) break
    ctx.textAlign = 'left'
    ctx.fillText(fragments[i], x, y)
    x += widths[i] + gap
  }
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export function drawWallSouvenirTicketText(
  ctx: CanvasRenderingContext2D,
  input: WallSouvenirTicketInput,
  slots: WallTicketTextSlot[],
  scale = 1,
) {
  const fragments = buildWallSouvenirTicketFragments(input)

  for (const slot of slots) {
    const texts = fragments.filter((fragment) => fragment.role === slot.role).map((f) => f.text)
    if (!texts.length) continue

    ctx.save()
    ctx.beginPath()
    ctx.rect(slot.x, slot.y, slot.w, slot.h)
    ctx.clip()

    if (slot.mode === 'scatter') {
      drawScattered(ctx, slot, texts, scale)
    } else {
      drawStacked(ctx, slot, texts, scale)
    }

    ctx.restore()
  }
}
