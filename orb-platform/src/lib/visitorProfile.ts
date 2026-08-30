import { resetInterview } from './interviewStore'
import type { BinaryAnswer } from './mirrorJourney'

/**
 * Station I's intake answers, carried forward to Station II so a handful
 * of its questions can gate on age or on "have you had previous
 * relationships?" Persisted to localStorage so a refresh on the same
 * device does not wipe the interview. Cross-device sharing still needs
 * the room hub. Missing data (visitor jumped straight to Station II with
 * nothing stored) defaults to the safest read: treated as a minor with
 * no prior relationships, so age/relationship-gated questions stay
 * skipped rather than risk showing them without consent.
 */
export type VisitorProfile = {
  callName: string
  age: number | null
  identity: string
  orientation: string
  doubtedOrientation: BinaryAnswer | null
  previousRelationships: BinaryAnswer | null
  origin: string
  livesWhereBorn: BinaryAnswer | null
  washFrequency: string
  lastInsecure: string
}

export const VISITOR_PROFILE_STORAGE_KEY = 'hons-visitor-profile'

export type ProfileStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function emptyProfile(): VisitorProfile {
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

function asBinaryAnswer(value: unknown): BinaryAnswer | null {
  return value === 'yes' || value === 'no' ? value : null
}

export function visitorProfileFromAnswers(answers: Record<string, string>): VisitorProfile {
  const ageValue = Number(answers.age)
  return {
    callName: answers.callName ?? '',
    age: Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null,
    identity: answers.identity ?? '',
    orientation: answers.orientation ?? '',
    doubtedOrientation: asBinaryAnswer(answers.doubtedOrientation),
    previousRelationships: asBinaryAnswer(answers.previousRelationships),
    origin: answers.origin ?? '',
    livesWhereBorn: asBinaryAnswer(answers.livesWhereBorn),
    washFrequency: answers.washFrequency ?? '',
    lastInsecure: answers.lastInsecure ?? '',
  }
}

export function parseVisitorProfile(value: unknown): VisitorProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const age =
    raw.age === null
      ? null
      : typeof raw.age === 'number' && Number.isFinite(raw.age) && raw.age > 0
        ? raw.age
        : null
  return {
    callName: typeof raw.callName === 'string' ? raw.callName : '',
    age,
    identity: typeof raw.identity === 'string' ? raw.identity : '',
    orientation: typeof raw.orientation === 'string' ? raw.orientation : '',
    doubtedOrientation: asBinaryAnswer(raw.doubtedOrientation),
    previousRelationships: asBinaryAnswer(raw.previousRelationships),
    origin: typeof raw.origin === 'string' ? raw.origin : '',
    livesWhereBorn: asBinaryAnswer(raw.livesWhereBorn),
    washFrequency: typeof raw.washFrequency === 'string' ? raw.washFrequency : '',
    lastInsecure: typeof raw.lastInsecure === 'string' ? raw.lastInsecure : '',
  }
}

function defaultStorage(): ProfileStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

function readStoredProfile(storage: ProfileStorage | undefined): VisitorProfile | null {
  try {
    const raw = storage?.getItem(VISITOR_PROFILE_STORAGE_KEY)
    if (!raw) return null
    return parseVisitorProfile(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

function writeStoredProfile(profile: VisitorProfile, storage: ProfileStorage | undefined) {
  try {
    storage?.setItem(VISITOR_PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Storage can be unavailable in privacy-restricted kiosk browsers.
  }
}

function clearStoredProfile(storage: ProfileStorage | undefined) {
  try {
    storage?.removeItem(VISITOR_PROFILE_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted kiosk browsers.
  }
}

let current: VisitorProfile | null = null

export function loadVisitorProfile(
  storage: ProfileStorage | undefined = defaultStorage(),
): VisitorProfile {
  return readStoredProfile(storage) ?? emptyProfile()
}

export function setVisitorProfile(
  profile: VisitorProfile,
  storage: ProfileStorage | undefined = defaultStorage(),
) {
  current = profile
  writeStoredProfile(profile, storage)
}

export function getVisitorProfile(
  storage: ProfileStorage | undefined = defaultStorage(),
): VisitorProfile {
  if (current === null) current = loadVisitorProfile(storage)
  return current
}

export function resetVisitorProfile(
  storage: ProfileStorage | undefined = defaultStorage(),
) {
  current = emptyProfile()
  clearStoredProfile(storage)
  resetInterview(storage)
}
