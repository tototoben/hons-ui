// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMING_COPY } from '../lib/wallForming'
import { WallFormingBlanket } from './WallFormingBlanket'

vi.mock('../lib/faceBank', () => ({
  loadFaceBankImages: () => Promise.resolve([]),
}))

describe('WallFormingBlanket', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('shows PARTNER FORMING on Debra and paints a forming canvas', () => {
    act(() =>
      root.render(
        <WallFormingBlanket role="debra" photobashSeed={1} loadingProgress={0} showCaption />,
      ),
    )
    expect(container.querySelector('.wall-forming-caption')?.textContent).toBe(FORMING_COPY)
    expect(container.querySelector('canvas.wall-forming-canvas')).not.toBeNull()
  })

  it('hides the caption on copy', () => {
    act(() =>
      root.render(
        <WallFormingBlanket role="copy" photobashSeed={1} loadingProgress={0} showCaption={false} />,
      ),
    )
    expect(container.querySelector('.wall-forming-caption')).toBeNull()
    expect(container.querySelector('canvas.wall-forming-canvas')).not.toBeNull()
  })
})
