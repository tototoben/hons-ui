/**
 * Read-only client for central's visit API. Station II/III kiosks and the
 * photobash wall poll GET /api/visits/active so they share one visitor's
 * Station I/II answers and face instead of each Pi's localStorage.
 */

import { getDeviceQuality } from './deviceQuality'

export const DEFAULT_CENTRAL_API = 'http://localhost:8087'

const CACHE_TTL_MS = 1500

export type VisitStationPayload = Record<string, unknown>

export type ActiveVisit = {
  visit_id: string
  state: string
  active_station?: number | null
  station_data: Record<string, VisitStationPayload>
  last_activity_at?: number
}

export type StationOneVisitPayload = {
  answers?: Record<string, string>
  faceCapture?: string | null
}

export type StationTwoVisitPayload = {
  answers?: Record<string, string>
  lightningAnswers?: Record<string, string>
  height?: number
}

export type VisitPersona = {
  visit_id: string
  system_prompt: string
}

let cachedVisits: ActiveVisit[] = []
let lastFetchAt = 0
let inflight: Promise<ActiveVisit[]> | null = null

export function centralApiBase(): string {
  if (typeof window === 'undefined') return DEFAULT_CENTRAL_API
  const params = new URLSearchParams(window.location.search)
  const explicit = params.get('central')
  if (explicit === '0' || explicit === 'false') return ''
  if (explicit) return explicit.replace(/\/$/, '')
  const { hostname, port, origin } = window.location
  if (
    port === '5176' &&
    origin &&
    (hostname === 'localhost' || hostname === '127.0.0.1')
  ) {
    return origin
  }
  return DEFAULT_CENTRAL_API
}

function stationKey(data: ActiveVisit['station_data'], station: number): VisitStationPayload | null {
  const raw = data[String(station)] ?? data[station as unknown as string]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as VisitStationPayload
}

export function pickVisitAtStation(station: number, visits: ActiveVisit[] = cachedVisits): ActiveVisit | null {
  const matches = visits.filter(
    (visit) => visit.active_station === station || visit.state === `station_${station}`,
  )
  if (!matches.length) return null
  return matches.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0))[0] ?? null
}

export function pickVisitForReveal(visits: ActiveVisit[] = cachedVisits): ActiveVisit | null {
  const reveal = visits.filter((visit) => visit.state === 'reveal')
  if (reveal.length) {
    return reveal.sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0))[0] ?? null
  }
  return pickVisitAtStation(3, visits) ?? pickVisitAtStation(2, visits)
}

/** Active visit for Station III ingest / reveal (station 3 first, else reveal). */
export function pickVisitForStationThree(visits: ActiveVisit[] = cachedVisits): ActiveVisit | null {
  return pickVisitAtStation(3, visits) ?? pickVisitForReveal(visits)
}

export function stationOnePayload(visit: ActiveVisit | null): StationOneVisitPayload | null {
  if (!visit) return null
  const raw = stationKey(visit.station_data, 1)
  if (!raw) return null
  const answers =
    raw.answers && typeof raw.answers === 'object' && !Array.isArray(raw.answers)
      ? (raw.answers as Record<string, string>)
      : undefined
  const faceCapture =
    typeof raw.faceCapture === 'string'
      ? raw.faceCapture
      : raw.faceCapture === null
        ? null
        : undefined
  return { answers, faceCapture }
}

export function stationTwoPayload(visit: ActiveVisit | null): StationTwoVisitPayload | null {
  if (!visit) return null
  const raw = stationKey(visit.station_data, 2)
  if (!raw) return null
  const answers =
    raw.answers && typeof raw.answers === 'object' && !Array.isArray(raw.answers)
      ? (raw.answers as Record<string, string>)
      : undefined
  const lightningAnswers =
    raw.lightningAnswers &&
    typeof raw.lightningAnswers === 'object' &&
    !Array.isArray(raw.lightningAnswers)
      ? (raw.lightningAnswers as Record<string, string>)
      : undefined
  const height = typeof raw.height === 'number' && Number.isFinite(raw.height) ? raw.height : undefined
  return { answers, lightningAnswers, height }
}

export function peekActiveVisits(): ActiveVisit[] {
  return cachedVisits
}

export function findVisitById(
  visitId: string,
  visits: ActiveVisit[] = cachedVisits,
): ActiveVisit | null {
  return visits.find((visit) => visit.visit_id === visitId) ?? null
}

export async function fetchVisitById(visitId: string): Promise<ActiveVisit | null> {
  if (!visitId) return null
  await refreshVisitCache(true)
  const cached = findVisitById(visitId)
  if (cached) return cached
  const base = centralApiBase()
  if (!base) return null
  try {
    const response = await fetch(`${base}/api/visits/${encodeURIComponent(visitId)}`, {
      cache: 'no-store',
    })
    if (!response.ok) return null
    const body = (await response.json()) as { visit?: ActiveVisit }
    return body.visit ?? null
  } catch {
    return null
  }
}

export function peekStationOneForStation(station: 2 | 3 | 'reveal'): StationOneVisitPayload | null {
  const visit =
    station === 'reveal'
      ? pickVisitForReveal()
      : pickVisitAtStation(station) ?? pickVisitForReveal()
  return stationOnePayload(visit)
}

export function peekStationTwoForStation(station: 3 | 'reveal'): StationTwoVisitPayload | null {
  const visit =
    station === 'reveal' ? pickVisitForReveal() : pickVisitAtStation(3) ?? pickVisitForReveal()
  return stationTwoPayload(visit)
}

export function peekVisitorFaceFromCentral(): string | null {
  const payload = peekStationOneForStation('reveal')
  return payload?.faceCapture ?? null
}

/** Read-only persona prompt from central (recomputed from aggregated station data). */
export async function fetchVisitPersona(visitId: string): Promise<VisitPersona | null> {
  const base = centralApiBase()
  if (!base || !visitId) return null
  try {
    const response = await fetch(
      `${base}/api/visits/${encodeURIComponent(visitId)}/persona`,
      { cache: 'no-store' },
    )
    if (!response.ok) return null
    const body = (await response.json()) as VisitPersona
    if (!body.visit_id || typeof body.system_prompt !== 'string') return null
    return body
  } catch {
    return null
  }
}

/** Persona for the visit currently at Station III / reveal. */
export async function fetchPersonaForCurrentVisit(): Promise<VisitPersona | null> {
  await refreshVisitCache(true)
  const visit = pickVisitForStationThree()
  if (!visit) return null
  return fetchVisitPersona(visit.visit_id)
}

export async function refreshVisitCache(force = false): Promise<ActiveVisit[]> {
  const base = centralApiBase()
  if (!base) return cachedVisits
  const now = Date.now()
  if (!force && inflight) return inflight
  if (!force && now - lastFetchAt < CACHE_TTL_MS && cachedVisits.length > 0) {
    return cachedVisits
  }

  inflight = (async () => {
    try {
      const response = await fetch(`${base}/api/visits/active`, { cache: 'no-store' })
      if (!response.ok) return cachedVisits
      const body = (await response.json()) as { visits?: ActiveVisit[] }
      cachedVisits = Array.isArray(body.visits) ? body.visits : []
      lastFetchAt = Date.now()
    } catch {
      // Central may be offline on a laptop-only dev session.
    } finally {
      inflight = null
    }
    return cachedVisits
  })()

  return inflight
}

export function resetVisitCacheForTests() {
  cachedVisits = []
  lastFetchAt = 0
  inflight = null
}

/** Kiosk Pis with ?central=… or arm-linux hardware wait for central's turn signal. */
export function shouldGateStationTurn(_station: 2 | 3): boolean {
  const base = centralApiBase()
  if (!base || typeof window === 'undefined') return false

  const explicit = new URLSearchParams(window.location.search).get('central')
  if (explicit && explicit !== '0' && explicit !== 'false') return true

  return getDeviceQuality() === 'kiosk'
}

/** True when central says this station should run its visitor flow. */
export function isStationTurnActive(
  station: 2 | 3,
  visits: ActiveVisit[] = cachedVisits,
): boolean {
  if (!shouldGateStationTurn(station)) return true
  if (!visits.length) return false

  if (station === 2) {
    return visits.some((visit) => visit.active_station === 2 || visit.state === 'station_2')
  }

  return visits.some(
    (visit) =>
      visit.active_station === 3 || visit.state === 'station_3' || visit.state === 'reveal',
  )
}

/** Remount key so a fresh visit (or return from waiting) starts clean. */
export function visitSessionKeyForStation(
  station: 2 | 3,
  visits: ActiveVisit[] = cachedVisits,
): string {
  if (station === 2) {
    return pickVisitAtStation(2, visits)?.visit_id ?? 'active'
  }
  const atStation = pickVisitAtStation(3, visits)
  if (atStation) return atStation.visit_id
  const reveal = visits.find((visit) => visit.state === 'reveal')
  return reveal?.visit_id ?? 'active'
}
