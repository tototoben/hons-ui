import { describe, expect, it } from 'vitest'
import { parseFaceBankManifest } from './faceBank'
import { buildWallCollagePlateState } from './wallCollagePlate'
import { pickTaggedStrangerAssignments } from './wallCollagePhotobash'

const faces = parseFaceBankManifest({
  faces: [
    { file: 'w1.jpg', presentation: 'woman', ageBand: 'young', smile: true },
    { file: 'w2.jpg', presentation: 'woman', ageBand: 'young', smile: false },
    { file: 'm1.jpg', presentation: 'man', ageBand: 'mid', smile: false },
  ],
})

describe('wallCollagePlate', () => {
  it('uses the same stranger assignments as the photowall picker', () => {
    const seed = 77
    const cue = { presentations: ['woman'] as const, ageBand: 'young' as const, smile: true }
    const state = buildWallCollagePlateState({
      seed,
      collageCue: cue,
      faces,
      visitorImage: null,
      staticCapture: true,
    })
    const direct = pickTaggedStrangerAssignments(seed, faces, cue, state.rects.length)
    expect(state.strangerAssignments).toEqual(direct)
  })

  it('freezes visitor reveal at the photowall static-capture end state', () => {
    const state = buildWallCollagePlateState({
      seed: 42,
      collageCue: {},
      faces,
      visitorImage: {} as HTMLImageElement,
      staticCapture: true,
    })
    expect(state.revealedCells.size).toBe(state.rects.length)
    expect(state.revealingCell).toBeNull()
  })
})
