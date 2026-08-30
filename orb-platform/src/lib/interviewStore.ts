import type {
  BinaryAnswer,
  StationOnePhase,
  StationOneState,
  StationTwoPhase,
  StationTwoState,
} from './mirrorJourney'

export const STATION_ONE_STORAGE_KEY = 'hons-station-1-state'
export const STATION_TWO_STORAGE_KEY = 'hons-station-2-state'

export type InterviewStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const STATION_ONE_PHASES: readonly StationOnePhase[] = [
  'intake',
  'analysis-intro',
  'scan-face',
  'scan-eyes',
  'scan-focus',
  'complete',
  'proceed',
]

const STATION_TWO_PHASES: readonly StationTwoPhase[] = [
  'percentile',
  'companion-intro',
  'debra-brief',
  'question',
  'height',
  'lightning-intro',
  'lightning',
  'complete',
]

function isStationOnePhase(value: unknown): value is StationOnePhase {
  return (STATION_ONE_PHASES as readonly string[]).includes(value as string)
}

function isStationTwoPhase(value: unknown): value is StationTwoPhase {
  return (STATION_TWO_PHASES as readonly string[]).includes(value as string)
}

function isBinaryAnswer(value: unknown): value is BinaryAnswer {
  return value === 'yes' || value === 'no'
}

function asStringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') return null
    record[key] = entry
  }
  return record
}

export function parseStationOneState(value: unknown): StationOneState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (!isStationOnePhase(raw.phase)) return null
  if (typeof raw.questionIndex !== 'number' || !Number.isFinite(raw.questionIndex) || raw.questionIndex < 0) {
    return null
  }
  const answers = asStringRecord(raw.answers)
  if (!answers) return null
  return {
    phase: raw.phase,
    questionIndex: Math.floor(raw.questionIndex),
    answers,
  }
}

export function parseStationTwoState(value: unknown): StationTwoState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (!isStationTwoPhase(raw.phase)) return null
  if (typeof raw.questionIndex !== 'number' || !Number.isFinite(raw.questionIndex) || raw.questionIndex < 0) {
    return null
  }
  if (typeof raw.height !== 'number' || !Number.isFinite(raw.height)) return null
  if (typeof raw.lightningIndex !== 'number' || !Number.isFinite(raw.lightningIndex) || raw.lightningIndex < 0) {
    return null
  }
  const answers = asStringRecord(raw.answers)
  const lightningAnswers = asStringRecord(raw.lightningAnswers)
  if (!answers || !lightningAnswers) return null
  const age =
    raw.age === null ? null : typeof raw.age === 'number' && Number.isFinite(raw.age) ? raw.age : null
  const previousRelationships =
    raw.previousRelationships === null || isBinaryAnswer(raw.previousRelationships)
      ? raw.previousRelationships
      : null
  return {
    phase: raw.phase,
    questionIndex: Math.floor(raw.questionIndex),
    answers,
    height: Math.min(1, Math.max(0, raw.height)),
    lightningIndex: Math.floor(raw.lightningIndex),
    lightningAnswers,
    age,
    previousRelationships,
  }
}

function defaultStorage(): InterviewStorage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage
}

function readJson(key: string, storage: InterviewStorage | undefined): unknown {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown, storage: InterviewStorage | undefined) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable in privacy-restricted kiosk browsers.
  }
}

export function loadStationOneState(
  storage: InterviewStorage | undefined = defaultStorage(),
): StationOneState | null {
  return parseStationOneState(readJson(STATION_ONE_STORAGE_KEY, storage))
}

export function saveStationOneState(
  state: StationOneState,
  storage: InterviewStorage | undefined = defaultStorage(),
) {
  writeJson(STATION_ONE_STORAGE_KEY, state, storage)
}

export function loadStationTwoState(
  storage: InterviewStorage | undefined = defaultStorage(),
): StationTwoState | null {
  return parseStationTwoState(readJson(STATION_TWO_STORAGE_KEY, storage))
}

export function saveStationTwoState(
  state: StationTwoState,
  storage: InterviewStorage | undefined = defaultStorage(),
) {
  writeJson(STATION_TWO_STORAGE_KEY, state, storage)
}

export function resetInterview(
  storage: InterviewStorage | undefined = defaultStorage(),
) {
  try {
    storage?.removeItem(STATION_ONE_STORAGE_KEY)
    storage?.removeItem(STATION_TWO_STORAGE_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted kiosk browsers.
  }
}
