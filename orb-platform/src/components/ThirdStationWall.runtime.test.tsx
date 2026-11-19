// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const collageProps = vi.hoisted(() => [] as Array<{ visitorReveal?: string; photobashSeed: number }>)
const dialogue = vi.hoisted(() => ({ available: false, state: { phase: 'idle', visit_id: null } }))
const central = vi.hoisted(() => ({ visits: [] as Array<Record<string, unknown>> }))

vi.mock('./WallCollageBlanket', () => ({
  WallCollageBlanket: (props: { visitorReveal?: string; photobashSeed: number }) => {
    collageProps.push(props)
    return <div data-testid="collage" data-reveal={props.visitorReveal} />
  },
}))
vi.mock('./WallFaceBlanket', () => ({ WallFaceBlanket: () => null }))
vi.mock('./WallFormingBlanket', () => ({ WallFormingBlanket: () => null }))
vi.mock('./RevealShellChrome', () => ({ RevealShellChrome: () => null }))
vi.mock('../lib/wallCollageBank', () => ({ useCollageBankReady: () => true }))
vi.mock('../lib/wallPhaseSync', () => ({
  useWallSyncedPhase: () => ({ phase: 'intro', loadingProgress: 0, photobashSeed: 7, collageCue: {} }),
}))
vi.mock('../lib/revealDialogue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/revealDialogue')>()
  return { ...actual, useRevealDialogue: () => dialogue }
})
vi.mock('../lib/collageCue', () => ({ collageCueFromVisitCentral: async () => ({}) }))
vi.mock('../lib/visitCentral', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/visitCentral')>()
  return {
    ...actual,
    refreshVisitCache: async () => central.visits,
    peekActiveVisits: () => central.visits,
  }
})

import { ThirdStationWall } from './ThirdStationWall'

async function flush() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve()
}

describe('ThirdStationWall reveal without a dialogue', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    collageProps.length = 0
    dialogue.available = false
    dialogue.state = { phase: 'idle', visit_id: null }
    central.visits = []
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  async function render() {
    await act(async () => {
      root.render(<ThirdStationWall role="status" />)
      await flush()
    })
  }

  it('shows the ambient collage while nobody is in reveal', async () => {
    central.visits = [{ visit_id: 'v-a', state: 'station_1', station_data: {} }]
    await render()
    expect(container.querySelector('[data-testid="collage"]')?.getAttribute('data-reveal')).toBe('off')
  })

  it('sweeps the reveal visitor in on every panel when no conversation runs', async () => {
    central.visits = [{ visit_id: 'v-a', state: 'reveal', station_data: {} }]
    await render()
    expect(container.querySelector('[data-testid="collage"]')?.getAttribute('data-reveal')).toBe('sweep')
  })

  it('leaves the reveal to a live dialogue when one is running', async () => {
    central.visits = [{ visit_id: 'v-a', state: 'reveal', station_data: {} }]
    dialogue.available = true
    dialogue.state = { phase: 'speaking', visit_id: 'v-a' }
    await render()
    expect(container.querySelector('[data-testid="collage"]')?.getAttribute('data-reveal')).toBe('dialogue')
  })
})
