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

import { StationOne } from './StationOne'
import { STATION_ONE_INTAKE } from '../lib/mirrorJourney'
import { applyStationVibe } from '../lib/stationVibe'
import { getVisitorProfile, resetVisitorProfile } from '../lib/visitorProfile'

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function submit(form: HTMLFormElement) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

const INTAKE_ANSWERS: Record<string, string> = {
  callName: 'Ada',
  age: '34',
  identity: 'woman',
  orientation: 'bisexual',
  doubtedOrientation: 'no',
  previousRelationships: 'yes',
  origin: 'London',
  livesWhereBorn: 'no',
  washFrequency: 'daily',
  lastInsecure: 'yesterday',
}

function answerIntake(container: HTMLDivElement, fromIndex = 0) {
  for (const question of STATION_ONE_INTAKE.slice(fromIndex)) {
    const value = INTAKE_ANSWERS[question.id]
    if (question.type === 'text') {
      const input = container.querySelector<HTMLInputElement>(`input[name="${question.id}"]`)!
      act(() => {
        setInput(input, value)
        submit(input.form!)
      })
    } else {
      act(() =>
        window.dispatchEvent(new KeyboardEvent('keydown', { key: value === 'yes' ? 'y' : 'n' })),
      )
    }
  }
}

describe('StationOne', () => {
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
    resetVisitorProfile()
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    container.remove()
  })

  it('asks the ten intake questions, then runs facial analysis through to Station II', async () => {
    act(() => root.render(<StationOne phaseDurationMs={20} />))

    expect(container.querySelectorAll('.journey-status > span')).toHaveLength(1)
    expect(container.querySelector('.journey-status')?.textContent).toBe('Welcome to Station I')
    expect(container.querySelector('label .journey-headline-canvas')).not.toBeNull()

    const callNameInput = container.querySelector<HTMLInputElement>('input[name="callName"]')!
    expect(callNameInput.getAttribute('aria-label')).toBe('What do you want us to call you?')
    act(() => {
      setInput(callNameInput, INTAKE_ANSWERS.callName)
      submit(callNameInput.form!)
    })

    const age = container.querySelector<HTMLInputElement>('input[name="age"]')!
    expect(age).not.toBeNull()
    expect(age.type).toBe('text')
    expect(age.getAttribute('inputMode') ?? age.getAttribute('inputmode')).toBe('numeric')
    expect(age.getAttribute('pattern')).toBe('[0-9]*')
    act(() => {
      setInput(age, INTAKE_ANSWERS.age)
      submit(age.form!)
    })

    answerIntake(container, 2)

    expect(container.textContent).toContain("Let's have a look at you")
    expect(container.querySelector('.journey-message .journey-headline-canvas')).not.toBeNull()

    const profile = getVisitorProfile()
    expect(profile.callName).toBe('Ada')
    expect(profile.age).toBe(34)
    expect(profile.previousRelationships).toBe('yes')

    await act(async () => {
      vi.advanceTimersByTime(20)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('Hold still, Ada')

    for (let step = 0; step < 2; step += 1) {
      await act(async () => {
        vi.advanceTimersByTime(20)
        await Promise.resolve()
      })
    }
    expect(container.textContent).toContain("I've got a sense of you")

    await act(async () => {
      vi.advanceTimersByTime(20)
      await Promise.resolve()
    })
    expect(container.textContent).toContain('Facial analysis complete')
    expect(container.textContent).not.toContain('Proceed to the next station')
    expect(container.querySelector('.journey-complete h1 .journey-headline-canvas')).not.toBeNull()

    // "Proceed to the next station" is its own screen, shown after a beat.
    await act(async () => {
      vi.advanceTimersByTime(20)
      await Promise.resolve()
    })
    expect(container.textContent).not.toContain('Facial analysis complete')
    expect(container.textContent).toContain('Proceed to the next station')
    expect(container.querySelector('.journey-complete h1 .journey-headline-canvas')).not.toBeNull()
    // Stations stay separate — no "continue to Station II" link.
    expect(container.querySelector('a')).toBeNull()
  })

  it('skips straight past text-question fields when answering yes/no by keyboard', () => {
    act(() => root.render(<StationOne phaseDurationMs={20} />))

    const callNameInput = container.querySelector<HTMLInputElement>('input[name="callName"]')!
    act(() => {
      setInput(callNameInput, 'Ada')
      submit(callNameInput.form!)
    })
    const ageInput = container.querySelector<HTMLInputElement>('input[name="age"]')!
    expect(ageInput.getAttribute('type')).toBe('text')
    act(() => {
      setInput(ageInput, '17')
      submit(ageInput.form!)
    })

    expect(container.querySelector('input[name="identity"]')).not.toBeNull()
  })

  it('does not leak the pressed y/n key into the next text question', () => {
    act(() => root.render(<StationOne phaseDurationMs={20} />))

    for (const [name, value] of [
      ['callName', 'Ada'],
      ['age', '34'],
      ['identity', 'woman'],
      ['orientation', 'bisexual'],
    ]) {
      const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
      act(() => {
        setInput(input, value)
        submit(input.form!)
      })
    }

    // doubtedOrientation, then previousRelationships — both yes/no, both
    // answered by keyboard, landing on "origin" (a text question) next.
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y' })))

    const originInput = container.querySelector<HTMLInputElement>('input[name="origin"]')!
    expect(originInput.value).toBe('')
  })

  it('restores the original station chrome when the warm look is off', () => {
    applyStationVibe('original')
    act(() => root.render(<StationOne phaseDurationMs={20} />))

    expect(container.querySelector('.journey-status')?.textContent).toBe('STATION I')
    expect(container.textContent).not.toContain('HOUSE OF NEGOTIATED SELVES')
  })
})
