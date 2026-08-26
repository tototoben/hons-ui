export type WallPanelRect = {
  wallWidth: number
  wallHeight: number
  panelX: number
  panelY: number
  panelWidth: number
  panelHeight: number
}

export type WallModeTransform = {
  wallWidth: number
  wallHeight: number
  scale: number
  translateX: number
  translateY: number
}

/** Portrait composition placed onto the wall with object-fit: cover. */
export const WALL_DESIGN = { width: 1080, height: 1920 }

export type WallDesignPlacement = {
  designWidth: number
  designHeight: number
  offsetX: number
  offsetY: number
  scale: number
}

/** Scale the portrait station so it covers the full wall bounding box. */
export function wallDesignPlacement(wallWidth: number, wallHeight: number): WallDesignPlacement {
  const scale = Math.max(wallWidth / WALL_DESIGN.width, wallHeight / WALL_DESIGN.height)
  const width = WALL_DESIGN.width * scale
  const height = WALL_DESIGN.height * scale
  return {
    designWidth: WALL_DESIGN.width,
    designHeight: WALL_DESIGN.height,
    offsetX: (wallWidth - width) / 2,
    offsetY: (wallHeight - height) / 2,
    scale,
  }
}

function readPositiveInt(params: URLSearchParams, key: string) {
  const value = Number(params.get(key))
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function readNonNegativeInt(params: URLSearchParams, key: string) {
  const value = Number(params.get(key))
  if (!Number.isFinite(value) || value < 0) return null
  return value
}

export function parseWallMode(search: string): WallPanelRect | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (params.get('wall') !== '1') return null

  const wallWidth = readPositiveInt(params, 'wallW')
  const wallHeight = readPositiveInt(params, 'wallH')
  const panelX = readNonNegativeInt(params, 'panelX')
  const panelY = readNonNegativeInt(params, 'panelY')
  const panelWidth = readPositiveInt(params, 'panelW')
  const panelHeight = readPositiveInt(params, 'panelH')

  if (
    wallWidth === null ||
    wallHeight === null ||
    panelX === null ||
    panelY === null ||
    panelWidth === null ||
    panelHeight === null
  ) {
    return null
  }

  if (panelX + panelWidth > wallWidth || panelY + panelHeight > wallHeight) return null

  return {
    wallWidth,
    wallHeight,
    panelX,
    panelY,
    panelWidth,
    panelHeight,
  }
}

export function isWallMode(search: string = window.location.search) {
  return parseWallMode(search) !== null
}

/**
 * Map one wall panel into the viewport.
 *
 * For multi-display face blankets, pass viewportWidth/Height equal to the
 * nominal panel size (not window.inner*) so every screen uses the same scale.
 * Fit that layer into the real window separately — otherwise mismatched
 * Chrome content sizes make adjacent seams drift.
 */
export function wallModeTransform(
  panel: WallPanelRect,
  viewportWidth: number,
  viewportHeight: number,
): WallModeTransform {
  const scale = Math.max(viewportWidth / panel.panelWidth, viewportHeight / panel.panelHeight)
  const translateX = -panel.panelX * scale || 0
  const translateY = -panel.panelY * scale || 0
  return {
    wallWidth: panel.wallWidth,
    wallHeight: panel.wallHeight,
    scale,
    translateX,
    translateY,
  }
}

/** Uniform fit of a nominal panel crop into the real browser viewport. */
export function panelFitScale(
  panelWidth: number,
  panelHeight: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return Math.max(viewportWidth / panelWidth, viewportHeight / panelHeight)
}

export function buildWallModeUrl(
  baseUrl: string,
  stationHash: string,
  panel: WallPanelRect,
  extraParams: Record<string, string> = {},
) {
  const url = new URL(baseUrl)
  url.searchParams.set('wall', '1')
  url.searchParams.set('wallW', String(panel.wallWidth))
  url.searchParams.set('wallH', String(panel.wallHeight))
  url.searchParams.set('panelX', String(panel.panelX))
  url.searchParams.set('panelY', String(panel.panelY))
  url.searchParams.set('panelW', String(panel.panelWidth))
  url.searchParams.set('panelH', String(panel.panelHeight))
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value)
  }
  url.hash = stationHash.startsWith('#') ? stationHash : `#/${stationHash.replace(/^\//, '')}`
  return url.toString()
}
