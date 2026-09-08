// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loop = vi.hoisted(() => ({
  photobashSeed: 1,
  collageCue: {},
  loadingProgress: 0,
  cycleKey: 0,
}))

vi.mock('../lib/wallPhaseSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/wallPhaseSync')>()
  return {
    ...actual,
    usePhotobashLoop: () => loop,
  }
})

vi.mock('../lib/faceBank', () => ({
  loadFaceBankImages: () => Promise.resolve([]),
  loadFaceBankEntries: () => Promise.resolve([]),
}))

vi.mock('../lib/wallCollageBank', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/wallCollageBank')>()
  return {
    ...actual,
    useCollageBankReady: () => true,
  }
})

import { PhotobashScreen } from './PhotobashScreen'

describe('PhotobashScreen collage wall', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    loop.loadingProgress = 0
    loop.photobashSeed = 1
    window.history.replaceState({}, '', '/?collage=1')
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.history.replaceState({}, '', '/')
  })

  it('skips the skeleton loading beat and shows the collage immediately', () => {
    act(() => root.render(<PhotobashScreen />))
    expect(container.querySelector('.wall-forming-canvas')).toBeNull()
    expect(container.querySelector('.wall-forming-caption')).toBeNull()
    const base = container.querySelector<HTMLImageElement>('.wall-collage-base')
    expect(base?.src).toContain('/assets/wall-avatar/match-face.png')
    expect(container.querySelector('.wall-collage-canvas')).not.toBeNull()
  })
})
