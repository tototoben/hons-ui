import {
  layoutWallCssAtMmScale,
  layoutWallPhysicalAtMmScale,
  type WallSimMode,
  type WallSimStageLayout,
} from './wallSimLayout'

/** HP 27w station kiosk, portrait after the Pi 90° rotate. */
export const HP_27W_STATION = {
  model: 'HP 27w',
  nativeLandscape: { w: 1920, h: 1080 },
  portraitCss: { w: 1080, h: 1920 },
  /** Official active area, landscape millimetres. */
  activeMmLandscape: { w: 598, h: 336 },
  pixelPitchMm: 0.31125,
  ppi: 82,
} as const

export const STATION_SIM_STATIONS = [
  { id: 'station-1', hash: '#/station-1', label: 'Station I' },
  { id: 'station-2', hash: '#/station-2', label: 'Station II' },
  { id: 'mirror', hash: '#/mirror', label: 'Station III' },
] as const

export type StationSimTarget = (typeof STATION_SIM_STATIONS)[number]['id']
export type StationSimScale = 'fit' | 'half' | 'life'

/** CSS reference pixel: 96 CSS px = 1 in. */
export const CSS_PX_PER_MM = 96 / 25.4

export const HP_27W_PORTRAIT_MM = {
  w: HP_27W_STATION.activeMmLandscape.h,
  h: HP_27W_STATION.activeMmLandscape.w,
} as const

export type StationSimStage = {
  nativeW: number
  nativeH: number
  scale: number
  stageW: number
  stageH: number
  percentOfPhysical: number
  ruler100MmPx: number
}

export function parseStationSimFrame(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.get('stationSimFrame') === '1'
}

export function buildStationSimStage(
  mode: StationSimScale,
  viewportWidth: number,
  viewportHeight: number,
  chromePx = 72,
): StationSimStage {
  const nativeW = HP_27W_STATION.portraitCss.w
  const nativeH = HP_27W_STATION.portraitCss.h
  const lifeScale = HP_27W_STATION.pixelPitchMm * CSS_PX_PER_MM
  const availW = Math.max(280, viewportWidth - 40)
  const availH = Math.max(240, viewportHeight - chromePx)

  let scale = lifeScale
  if (mode === 'half') scale = lifeScale / 2
  if (mode === 'fit') scale = Math.min(availW / nativeW, availH / nativeH, 1)

  return {
    nativeW,
    nativeH,
    scale,
    stageW: nativeW * scale,
    stageH: nativeH * scale,
    percentOfPhysical: (scale / lifeScale) * 100,
    ruler100MmPx: 100 * CSS_PX_PER_MM * (mode === 'fit' ? scale / lifeScale : mode === 'half' ? 0.5 : 1),
  }
}

export const STATION_SIM_GAP_MM = 40

export type StationSimFloor = {
  cssPxPerMm: number
  percentOfPhysical: number
  ruler100MmPx: number
  station: StationSimStage
  wall: WallSimStageLayout
  floorW: number
  floorH: number
}

function cssPxPerMmForMode(mode: StationSimScale) {
  if (mode === 'half') return CSS_PX_PER_MM / 2
  return CSS_PX_PER_MM
}

function floorAtMmScale(cssPxPerMm: number, wallSeam: WallSimMode): StationSimFloor {
  const lifeScale = HP_27W_STATION.pixelPitchMm * CSS_PX_PER_MM
  const stationScale = HP_27W_STATION.pixelPitchMm * cssPxPerMm
  const station: StationSimStage = {
    nativeW: HP_27W_STATION.portraitCss.w,
    nativeH: HP_27W_STATION.portraitCss.h,
    scale: stationScale,
    stageW: HP_27W_STATION.portraitCss.w * stationScale,
    stageH: HP_27W_STATION.portraitCss.h * stationScale,
    percentOfPhysical: (stationScale / lifeScale) * 100,
    ruler100MmPx: 100 * cssPxPerMm,
  }
  const wall =
    wallSeam === 'physical'
      ? layoutWallPhysicalAtMmScale(cssPxPerMm)
      : layoutWallCssAtMmScale(cssPxPerMm)
  const gap = STATION_SIM_GAP_MM * cssPxPerMm
  return {
    cssPxPerMm,
    percentOfPhysical: station.percentOfPhysical,
    ruler100MmPx: station.ruler100MmPx,
    station,
    wall,
    floorW: station.stageW + gap + wall.stageW,
    floorH: Math.max(station.stageH, wall.stageH),
  }
}

/** Station cabinet + photobash wall sharing one millimetre scale. */
export function buildStationSimFloor(
  mode: StationSimScale,
  wallSeam: WallSimMode,
  viewportWidth: number,
  viewportHeight: number,
  chromePx = 88,
): StationSimFloor {
  const life = floorAtMmScale(cssPxPerMmForMode(mode === 'fit' ? 'life' : mode), wallSeam)
  if (mode !== 'fit') return life
  const availW = Math.max(280, viewportWidth - 48)
  const availH = Math.max(240, viewportHeight - chromePx)
  const fit = Math.min(availW / life.floorW, availH / life.floorH, 1)
  return floorAtMmScale(CSS_PX_PER_MM * fit, wallSeam)
}

