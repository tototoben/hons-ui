import { describe, expect, it } from 'vitest'
import {
  dialogueOwnsWall,
  dialogueRevealCount,
  EMPTY_REVEAL_DIALOGUE,
  normalizeRevealDialogue,
  revealDialogueTarget,
} from './revealDialogue'

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

  it('owns the wall only while a session is live', () => {
    const at = (phase: typeof EMPTY_REVEAL_DIALOGUE.phase) => ({ ...EMPTY_REVEAL_DIALOGUE, phase })
    expect(dialogueOwnsWall(true, at('idle'))).toBe(false)
    expect(dialogueOwnsWall(true, at('ended'))).toBe(false)
    expect(dialogueOwnsWall(true, at('error'))).toBe(false)
    expect(dialogueOwnsWall(true, at('intro'))).toBe(true)
    expect(dialogueOwnsWall(true, at('closing'))).toBe(true)
    expect(dialogueOwnsWall(false, at('speaking'))).toBe(false)
  })

  it('supports explicit service targets and a disable switch', () => {
    expect(revealDialogueTarget('?dialogue=http://studio:9000/')).toBe('http://studio:9000')
    expect(revealDialogueTarget('?dialogue=0')).toBeNull()
    expect(revealDialogueTarget('')).toBe('http://127.0.0.1:8191')
  })
})

describe('dialogueRevealCount', () => {
  const at = (phase: (typeof EMPTY_REVEAL_DIALOGUE)['phase'], turn: number) => ({
    ...EMPTY_REVEAL_DIALOGUE,
    phase,
    turn,
  })

  it('shows nothing outside a session', () => {
    expect(dialogueRevealCount(at('idle', 0))).toBe(0)
    expect(dialogueRevealCount(at('error', 3))).toBe(0)
  })

  it('reveals the first piece with the opening and one more per real reply', () => {
    expect(dialogueRevealCount(at('intro', 0))).toBe(1)
    expect(dialogueRevealCount(at('speaking', 1))).toBe(2)
    expect(dialogueRevealCount(at('mirroring', 3))).toBe(4)
  })

  it('holds steady while listening or thinking -- pieces never retreat', () => {
    expect(dialogueRevealCount(at('listening', 2))).toBe(3)
    expect(dialogueRevealCount(at('thinking', 2))).toBe(3)
  })

  it('gives a silent visitor nothing beyond the opening (reprompts do not count)', () => {
    // The reprompt path re-enters speaking without incrementing turn.
    expect(dialogueRevealCount(at('speaking', 0))).toBe(1)
  })

  it('adds one final piece for the cold close', () => {
    expect(dialogueRevealCount(at('closing', 2))).toBe(4)
    expect(dialogueRevealCount(at('closing', 0))).toBe(2)
  })
})
