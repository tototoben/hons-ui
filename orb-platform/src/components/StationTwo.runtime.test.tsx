// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../hooks/useMirrorCamera', () => ({
  useMirrorCamera: () => ({
    videoRef: { current: null },
    status: 'denied',
    landmarks: [],
    signals: {
      blink: 0, gazeX: 0, gazeY: 0, mouthOpen: 0, smile: 0,
      browLift: 0, headYaw: 0, headPitch: 0, headRoll: 0,
    },
    appearance: null,
  }),
}))

vi.mock('./MirrorGuideOrb', () => ({
  MirrorGuideOrb: ({ className }: { className?: string }) => <div className={className} />,
}))

import { StationTwo } from './StationTwo'
import { applyStationVibe } from '../lib/stationVibe'
import { setVisitorProfile } from '../lib/visitorProfile'

function emptyProfile() {
  return {
    callName: '',
    age: null,
    identity: '',
    orientation: '',
    doubtedOrientation: null,
    previousRelationships: null,
    origin: '',
    livesWhereBorn: null,
    washFrequency: '',
    lastInsecure: '',
  }
}

describe('StationTwo', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
    applyStationVibe('warm')
    setVisitorProfile({ ...emptyProfile(), age: 25, previousRelationships: 'yes' })
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    container.remove()
    setVisitorProfile(emptyProfile())
  })

  it('moves from the category readout through the question set, height, and lightning round', async () => {
    act(() => root.render(<StationTwo phaseDurationMs={20} />))

    expect(container.textContent).toContain('category Rho106')
    expect(container.querySelector('.journey-message .journey-headline-canvas')).not.toBeNull()
    expect(container.textContent).toContain('Listening')
    expect(container.querySelectorAll('.journey-status > span')).toHaveLength(1)
    expect(container.querySelector('.journey-debra-introduction')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(20)
      await Promise.resolve()
    })
    expect(container.querySelector('[aria-label="Debra, companion guide"]')).not.toBeNull()
    expect(container.textContent).toContain('AI partner')
    const introduction = container.querySelector('.journey-debra-introduction')
    expect(introduction?.textContent).toBe(
      'I will help you describe the partner you believe you want.',
    )

    await act(async () => {
      vi.advanceTimersByTime(20)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('But first we need you')

    await act(async () => {
      vi.advanceTimersByTime(20)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('Is attractiveness important to you?')

    const answerYesNo = () => {
      act(() => container.querySelector<HTMLButtonElement>('.journey-choice button')!.click())
    }

    answerYesNo() // attractiveness
    expect(container.textContent).toContain("Do you think you're a smart person?")
    answerYesNo() // selfSmart
    expect(container.textContent).toContain('Should your partner be smart?')
    answerYesNo() // partnerSmart -> yes, so "How smart?" should follow
    expect(container.textContent).toContain('How smart?')

    const smartSlider = container.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(smartSlider).not.toBeNull()
    act(() => container.querySelector<HTMLButtonElement>('.journey-height-confirm')!.click())
    expect(container.textContent).toContain('Do you want a traditional relationship?')

    answerYesNo() // traditional
    expect(container.textContent).toContain('Have you ever watched pornography?')
    answerYesNo() // pornography -> yes, unlocks the AI-porn follow-up
    expect(container.textContent).toContain('Have you knowingly watched AI pornography?')
    answerYesNo() // aiPornography
    expect(container.textContent).toContain('Do you have a high libido?')
    answerYesNo() // libido
    expect(container.textContent).toContain('Have you ever thought about cheating?')
    answerYesNo() // cheating
    expect(container.textContent).toContain('Do you believe in a higher power?')
    answerYesNo() // higherPower -> yes, unlocks "God?"
    expect(container.textContent).toContain('God?')

    // Answer "no" to God, which should ask the open "Something else?" text question.
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })))
    expect(container.textContent).toContain('Something else?')
    const somethingElseInput = container.querySelector<HTMLInputElement>(
      '#station-two-text-question',
    )!
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(somethingElseInput, 'the universe')
      somethingElseInput.dispatchEvent(new Event('input', { bubbles: true }))
      somethingElseInput.form!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    })
    expect(container.textContent).toContain('Do you practice escapism?')
    answerYesNo() // escapism

    const heightSlider = container.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(heightSlider).not.toBeNull()
    expect(container.textContent).toContain('How tall is your ideal partner?')
    expect(container.querySelector('[aria-label="Companion silhouette"]')).not.toBeNull()

    act(() => container.querySelector<HTMLButtonElement>('.journey-height-confirm')!.click())
    expect(container.textContent).toContain('Just a few quick')

    await act(async () => {
      vi.advanceTimersByTime(20)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('Beauty or')

    for (const pair of ['Inside', 'Process', 'Calm', 'Sex', 'Rebellion', 'Nature']) {
      const leftButton = container.querySelectorAll<HTMLButtonElement>('.journey-choice button')[0]
      act(() => leftButton.click())
      expect(container.textContent).toContain(pair)
    }
    act(() => container.querySelectorAll<HTMLButtonElement>('.journey-choice button')[0].click())

    expect(container.textContent).toContain("When you're ready")
    expect(container.querySelector('.journey-complete h1 .journey-headline-canvas')).not.toBeNull()
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#/mirror')
  })

  it('skips the adult-gated and follow-up questions for a visitor under 18', async () => {
    setVisitorProfile({ ...emptyProfile(), age: 15, previousRelationships: 'no' })
    act(() => root.render(<StationTwo phaseDurationMs={20} />))

    for (let step = 0; step < 3; step += 1) {
      await act(async () => {
        vi.advanceTimersByTime(20)
        await Promise.resolve()
      })
    }
    expect(container.textContent).toContain('Is attractiveness important to you?')

    const answerNo = () => {
      act(() => container.querySelectorAll<HTMLButtonElement>('.journey-choice button')[1]!.click())
    }

    answerNo() // attractiveness
    answerNo() // selfSmart
    answerNo() // partnerSmart -> no, so "How smart?" is skipped
    expect(container.textContent).toContain('Do you want a traditional relationship?')
    answerNo() // traditional
    // pornography/libido/cheating are all gated behind adulthood.
    expect(container.textContent).toContain('Do you believe in a higher power?')
    answerNo() // higherPower -> no, so "God?" is skipped
    expect(container.textContent).toContain('Do you practice escapism?')
  })

  it('keeps the opening text states on the original three-second cadence', async () => {
    act(() => root.render(<StationTwo />))

    await act(async () => {
      vi.advanceTimersByTime(2999)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('category Rho106')

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('AI partner')

    await act(async () => {
      vi.advanceTimersByTime(3000)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('But first we need you')

    await act(async () => {
      vi.advanceTimersByTime(2999)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('But first we need you')

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('Is attractiveness important to you?')
  })
})
