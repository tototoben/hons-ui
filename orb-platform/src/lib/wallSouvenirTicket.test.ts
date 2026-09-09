import { describe, expect, it } from 'vitest'
import { collageRects } from './wallCollagePhotobash'
import {
  buildSouvenirTextSlots,
  computeSouvenirCollagePlacement,
  rectOverlapsCollagePiece,
} from './wallSouvenirLayout'
import {
  buildWallSouvenirTicketFragments,
  buildWallSouvenirTicketLines,
  PLACEHOLDER_CALL_NAME,
  shortVisitLabel,
  visitorNumberFromSeed,
  wallSouvenirTicketInputFromVisit,
} from './wallSouvenirTicket'
import type { ActiveVisit } from './visitCentral'

const sampleVisit: ActiveVisit = {
  visit_id: 'v-abc123def456',
  state: 'reveal',
  station_data: {
    '1': {
      answers: {
        callName: 'Ada',
        identity: 'woman',
        age: '28',
        orientation: 'bisexual',
      },
    },
    '2': { answers: { attractiveness: 'yes' } },
  },
}

describe('wallSouvenirTicket', () => {
  it('keeps text slots outside collage pieces on the centered souvenir layout', () => {
    const placement = computeSouvenirCollagePlacement(3585, 5258)
    const rects = collageRects(42)
    const slots = buildSouvenirTextSlots(placement, rects)
    expect(slots.length).toBeGreaterThan(0)
    for (const slot of slots) {
      expect(rectOverlapsCollagePiece(slot, rects, placement)).toBe(false)
    }
  })

  it('spreads fragmented copy across white-gap slots', () => {
    const fragments = buildWallSouvenirTicketFragments({
      photobashSeed: 42,
      collageCue: { ageBand: 'young', smile: true },
    })
    expect(fragments.some((entry) => entry.role === 'title' && entry.text === 'HOUSE')).toBe(true)
    expect(fragments.some((entry) => entry.role === 'spine' && entry.text === 'negotiated')).toBe(true)
    expect(fragments.some((entry) => entry.role === 'detail' && entry.text === `${PLACEHOLDER_CALL_NAME}'s perfect partner`)).toBe(
      true,
    )
    expect(fragments.some((entry) => entry.role === 'footer' && entry.text === 'archived copy')).toBe(true)
    expect(new Set(fragments.map((entry) => entry.role)).size).toBeGreaterThan(3)
  })

  it('uses visit id and station answers when available', () => {
    const lines = buildWallSouvenirTicketLines(
      wallSouvenirTicketInputFromVisit(sampleVisit, {
        visitId: sampleVisit.visit_id,
        photobashSeed: 42,
      }),
    )
    expect(lines[0]).toBe('HOUSE OF NEGOTIATED SELVES')
    expect(lines[1]).toBe(shortVisitLabel('v-abc123def456'))
    expect(lines[2]).toBe("Ada's perfect partner")
    expect(lines.some((line) => /^\d{4}-\d{2}-\d{2}$/.test(line))).toBe(true)
    expect(lines).toContain('archived copy')
  })

  it('falls back to visitor number and vague copy without a visit', () => {
    const lines = buildWallSouvenirTicketLines({
      photobashSeed: 42,
      collageCue: { ageBand: 'young' },
    })
    expect(lines[1]).toBe(visitorNumberFromSeed(42))
    expect(lines[2]).toBe(`${PLACEHOLDER_CALL_NAME}'s perfect partner`)
    expect(lines).toContain('archived copy')
  })
})
