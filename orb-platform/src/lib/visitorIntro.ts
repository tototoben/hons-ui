/**
 * Station III's spoken self-intro, kept in memory and localStorage for the
 * rest of this visit so ARS can read it with the Station I/II answers.
 * Cleared on reset like the rest of the journey state.
 */

export const VISITOR_INTRO_STORAGE_KEY = 'hons-visitor-intro'

export type IntroStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): IntroStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

let current = ''

export function setVisitorIntro(
  text: string,
  storage: IntroStorage | undefined = defaultStorage(),
) {
  current = text.trim()
  try {
    if (current) storage?.setItem(VISITOR_INTRO_STORAGE_KEY, current)
    else storage?.removeItem(VISITOR_INTRO_STORAGE_KEY)
  } catch {
    // Privacy-restricted kiosk browsers can block storage.
  }
}

export function getVisitorIntro(storage: IntroStorage | undefined = defaultStorage()): string {
  if (current) return current
  try {
    current = storage?.getItem(VISITOR_INTRO_STORAGE_KEY)?.trim() ?? ''
  } catch {
    current = ''
  }
  return current
}

export function resetVisitorIntro(storage: IntroStorage | undefined = defaultStorage()) {
  current = ''
  try {
    storage?.removeItem(VISITOR_INTRO_STORAGE_KEY)
  } catch {
    // Privacy-restricted kiosk browsers can block storage.
  }
}
