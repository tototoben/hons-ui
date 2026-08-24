// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DebraVoiceClip, thirdStationDebraClipFor } from './DebraVoice'

describe('thirdStationDebraClipFor', () => {
  it.each([
    ['intro', '/audio/debra/06-now-is-your-chance.mp3'],
    ['prompt', '/audio/debra/07-introduce-yourself-to-your-future-partner.mp3'],
    ['recording', null],
    ['loading', null],
  ] as const)('maps %s to its spoken clip', (phase, expected) => {
    expect(thirdStationDebraClipFor(phase)).toBe(expected)
  })
})

describe('DebraVoiceClip', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.restoreAllMocks()
    container.remove()
  })

  it('starts the given clip and stops the previous one on transition', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    await act(async () => root.render(<DebraVoiceClip src="/audio/debra/06-now-is-your-chance.mp3" />))

    const audio = container.querySelector('audio')!
    expect(audio.getAttribute('src')).toBe('/audio/debra/06-now-is-your-chance.mp3')
    expect(play).toHaveBeenCalledTimes(1)

    audio.currentTime = 1.4
    await act(async () =>
      root.render(
        <DebraVoiceClip src="/audio/debra/07-introduce-yourself-to-your-future-partner.mp3" />,
      ),
    )

    expect(audio.getAttribute('src')).toBe(
      '/audio/debra/07-introduce-yourself-to-your-future-partner.mp3',
    )
    expect(pause).toHaveBeenCalledTimes(1)
    expect(audio.currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('renders no audio element when there is no clip', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    await act(async () => root.render(<DebraVoiceClip src={null} />))

    expect(container.querySelector('audio')).toBeNull()
  })

  it('retries blocked autoplay from the visitor click gesture', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValueOnce(new DOMException('Autoplay blocked', 'NotAllowedError'))
      .mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    await act(async () => {
      root.render(<DebraVoiceClip src="/audio/debra/06-now-is-your-chance.mp3" />)
      await Promise.resolve()
    })
    await act(async () => {
      window.dispatchEvent(new MouseEvent('click'))
      await Promise.resolve()
    })

    expect(play).toHaveBeenCalledTimes(2)
  })
})
