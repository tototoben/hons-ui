import { describe, expect, it } from 'vitest'
import { normalizeRevealDialogue, revealDialogueTarget } from './revealDialogue'

describe('reveal dialogue transport', () => {
  it('normalizes an SSE snapshot and clamps live levels', () => {
    expect(
      normalizeRevealDialogue({
        session_id: 'v-1',
        phase: 'mirroring',
        turn: 4,
        details: [{ key: 'place', value: 'forest', learned_turn: 1 }, { nope: true }],
        archetypes: { ego: 'Hero', bad: 2 },
        mirror_intensity: 1.4,
        mic_level: -1,
      }),
    ).toMatchObject({
      session_id: 'v-1',
      phase: 'mirroring',
      detail_count: 1,
      mirror_intensity: 1,
      mic_level: 0,
      archetypes: { ego: 'Hero' },
    })
  })

  it('supports explicit service targets and a disable switch', () => {
    expect(revealDialogueTarget('?dialogue=http://studio:9000/')).toBe('http://studio:9000')
    expect(revealDialogueTarget('?dialogue=0')).toBeNull()
    expect(revealDialogueTarget('')).toBe('http://127.0.0.1:8191')
  })
})
