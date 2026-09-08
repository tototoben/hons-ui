import type { ActiveVisit } from './visitCentral'
import { centralApiBase, isStationTurnActive, shouldGateStationTurn } from './visitCentral'
import { photowallQueueStatus, readPhotowallQueue } from './photowallQueue'

export type StationRuntimeStatus =
  | 'offline'
  | 'waiting'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'error'

export type StationStatusSnapshot = {
  station: 1 | 2 | 3
  status: StationRuntimeStatus
  visitId: string | null
  centralState: string | null
  detail: string
}

function visitForStation(station: 1 | 2 | 3, visits: ActiveVisit[]): ActiveVisit | null {
  if (station === 1) {
    const active =
      visits.find((visit) => visit.active_station === 1 || visit.state === 'station_1') ?? null
    if (active) return active
    return (
      visits.find((visit) => {
        const raw = visit.station_data['1']
        return raw && typeof raw === 'object' && Object.keys(raw).length > 0
      }) ?? null
    )
  }
  if (station === 2) {
    return (
      visits.find((visit) => visit.active_station === 2 || visit.state === 'station_2') ?? null
    )
  }
  return (
    visits.find(
      (visit) =>
        visit.active_station === 3 || visit.state === 'station_3' || visit.state === 'reveal',
    ) ?? null
  )
}

export function deriveStationStatus(
  station: 1 | 2 | 3,
  visits: ActiveVisit[],
  options: {
    centralReachable?: boolean
    localPhase?: string | null
    localComplete?: boolean
  } = {},
): StationStatusSnapshot {
  const centralReachable = options.centralReachable ?? Boolean(centralApiBase())
  if (!centralReachable) {
    return {
      station,
      status: 'offline',
      visitId: null,
      centralState: null,
      detail: 'Central API unavailable',
    }
  }

  if (!visits.length) {
    return {
      station,
      status: station === 1 ? 'ready' : 'waiting',
      visitId: null,
      centralState: null,
      detail: station === 1 ? 'Waiting for presence enter' : 'No active visit',
    }
  }

  const visit = visitForStation(station, visits)
  if (!visit) {
    if (
      station > 1 &&
      shouldGateStationTurn(station as 2 | 3) &&
      !isStationTurnActive(station as 2 | 3, visits)
    ) {
      return {
        station,
        status: 'waiting',
        visitId: null,
        centralState: visits[0]?.state ?? null,
        detail: 'Waiting for your turn',
      }
    }
    return {
      station,
      status: 'waiting',
      visitId: null,
      centralState: visits[0]?.state ?? null,
      detail: 'Visitor not at this station yet',
    }
  }

  const stationData = visit.station_data[String(station)]
  const hasStationPayload =
    stationData && typeof stationData === 'object' && Object.keys(stationData).length > 0

  if (hasStationPayload || options.localComplete) {
    return {
      station,
      status: 'completed',
      visitId: visit.visit_id,
      centralState: visit.state,
      detail: 'Station data saved',
    }
  }

  if (options.localPhase && options.localPhase !== 'intro' && options.localPhase !== 'percentile') {
    return {
      station,
      status: 'in_progress',
      visitId: visit.visit_id,
      centralState: visit.state,
      detail: `Phase ${options.localPhase}`,
    }
  }

  return {
    station,
    status: 'ready',
    visitId: visit.visit_id,
    centralState: visit.state,
    detail: 'Ready for visitor',
  }
}

export function photowallRuntimeStatus() {
  const snapshot = readPhotowallQueue()
  const status = photowallQueueStatus(snapshot)
  if (!snapshot.jobs.length) {
    return { status: 'offline' as const, detail: 'Queue empty', ...status }
  }
  if (status.errored > 0 && !status.busy && status.waiting === 0) {
    return { status: 'error' as const, detail: 'Last reveal failed', ...status }
  }
  if (status.busy) {
    return { status: 'in_progress' as const, detail: 'Showing reveal', ...status }
  }
  if (status.waiting > 0) {
    return { status: 'waiting' as const, detail: `${status.waiting} reveal(s) queued`, ...status }
  }
  return { status: 'ready' as const, detail: 'Queue idle', ...status }
}
