import type { BinaryAnswer } from './mirrorJourney'

/**
 * Station I's intake answers, carried forward to Station II so a handful
 * of its questions can gate on age or on "have you had previous
 * relationships?" — both stations run in the same SPA session (hash
 * routing, no page reload), so a plain in-memory module is enough, same
 * pattern as mirrorSettings/stationVibe. Missing data (visitor jumped
 * straight to Station II) defaults to the safest read: treated as a minor
 * with no prior relationships, so age/relationship-gated questions stay
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

let current: VisitorProfile = emptyProfile()

export function setVisitorProfile(profile: VisitorProfile) {
  current = profile
}

export function getVisitorProfile(): VisitorProfile {
  return current
}

export function resetVisitorProfile() {
  current = emptyProfile()
}

function asBinaryAnswer(value: string | undefined): BinaryAnswer | null {
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
