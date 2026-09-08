// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StationSim } from './StationSim'
import { readLastRevealReady, REVEAL_STORAGE_KEY } from '../lib/photobashTrigger'

describe('StationSim', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    window.location.hash = '#/station-sim'
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('starts the real reveal pipeline from the simulator', () => {
    window.localStorage.removeItem(REVEAL_STORAGE_KEY)
    act(() => root.render(<StationSim />))
    const generate = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Generate photobash',
    )
    expect(generate).toBeDefined()
    act(() => generate!.click())
    expect(readLastRevealReady()?.type).toBe('reveal-ready')
    expect(readLastRevealReady()?.photobashSeed).toBeGreaterThan(0)
    window.localStorage.removeItem(REVEAL_STORAGE_KEY)
  })

  it('frames Station I at life-size and can switch to Station II', () => {
    act(() => root.render(<StationSim />))
    const station = container.querySelector('iframe[title="station-1 HP 27w preview"]')
    expect(station).not.toBeNull()
    expect(station?.getAttribute('src')).toContain('stationSimFrame=1')
    expect(station?.getAttribute('src')).toContain('simStation=station-1')
    expect(station?.getAttribute('src')).toContain('#/station-1')
    expect(container.querySelector('.station-sim-meta')?.textContent).toMatch(/photobash wall/)
    const wall = [...container.querySelectorAll('iframe')].filter((frame) =>
      frame.getAttribute('src')?.includes('wallRole='),
    )
    expect(wall).toHaveLength(6)
    expect(wall[0]?.getAttribute('src')).toContain('#/photobash')
    act(() => {
      ;[...container.querySelectorAll('button')].find((button) => button.textContent === 'Station II')!.click()
    })
    const stationTwo = container.querySelector('iframe[title="station-2 HP 27w preview"]')
    expect(stationTwo?.getAttribute('src')).toContain('simStation=station-2')
    expect(stationTwo?.getAttribute('src')).toContain('#/station-2')
    act(() => {
      ;[...container.querySelectorAll('button')].find((button) => button.textContent === 'Station III')!.click()
    })
    const stationThree = container.querySelector('iframe[title="mirror HP 27w preview"]')
    expect(stationThree?.getAttribute('src')).toContain('simStation=mirror')
    expect(stationThree?.getAttribute('src')).toContain('#/mirror')
  })
})
