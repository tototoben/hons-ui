import { describe, expect, it } from 'vitest'
import {
  getVisitorIntro,
  resetVisitorIntro,
  setVisitorIntro,
  VISITOR_INTRO_STORAGE_KEY,
} from './visitorIntro'

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial }
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
}

describe('visitorIntro', () => {
  it('stores and clears the spoken intro', () => {
    const storage = memoryStorage()
    resetVisitorIntro(storage)
    setVisitorIntro('  hello there  ', storage)
    expect(getVisitorIntro(storage)).toBe('hello there')
    expect(storage.getItem(VISITOR_INTRO_STORAGE_KEY)).toBe('hello there')
    resetVisitorIntro(storage)
    expect(getVisitorIntro(storage)).toBe('')
  })
})
