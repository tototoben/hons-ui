// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loop = vi.hoisted(() => ({
  photobashSeed: 1,
  loadingProgress: 0,
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
}))

import { PhotobashScreen } from './PhotobashScreen'
import { FORMING_COPY } from '../lib/wallForming'

describe('PhotobashScreen forming prelude', () => {
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

  it('mounts forming with PARTNER FORMING when wallRole is missing', () => {
    act(() => root.render(<PhotobashScreen />))
    expect(container.querySelector('.wall-forming-caption')?.textContent).toBe(FORMING_COPY)
    expect(container.querySelector('.wall-forming-canvas')).not.toBeNull()
    expect(container.querySelector('.wall-collage-canvas')).toBeNull()
  })

  it('cuts to collage once loadingProgress reaches 1', () => {
    loop.loadingProgress = 1
    act(() => root.render(<PhotobashScreen />))
    expect(container.querySelector('.wall-forming-canvas')).toBeNull()
    expect(container.querySelector('.wall-collage-canvas')).not.toBeNull()
    expect(container.querySelector('.wall-forming-caption')).toBeNull()
  })
})
