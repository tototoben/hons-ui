export const WALL_ROLES = ['code', 'debra', 'copy', 'guide', 'avatar', 'status'] as const

export type WallRole = (typeof WALL_ROLES)[number]

export function parseWallRole(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): WallRole | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const role = params.get('wallRole')
  if (!role) return null
  return (WALL_ROLES as readonly string[]).includes(role) ? (role as WallRole) : null
}

export function isWallRoleMode(search?: string) {
  return parseWallRole(search) !== null
}

/** High-contrast layout cards for photographing the physical wall. */
export function parseWallCalibrate(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.get('wallCal') === '1'
}

/** Collage photobash (WallCollageBlanket) is the live wall reveal.
 * Pass collage=0 to fall back to the older WallFaceBlanket glitch. */
export function parseWallCollage(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.get('collage') !== '0'
}

/** Hardware notes for the measured Mac Studio wall. */
export const WALL_DISPLAY_HARDWARE = {
  monitor: {
    model: 'Lenovo L24i-4A',
    native: '1920×1080',
    sizeInches: 23.8,
    /** Approx. when driven at native FHD. */
    ppi: 93,
    bezelMm: { side: 2, top: 2, bottom: 10.4 },
    notes: 'Four units: three portrait (code, status, copy) and one landscape (guide).',
  },
  tv: {
    model: 'TCL 43P615',
    native: '3840×2160',
    sizeInches: 43,
    notes:
      'Two units. One is landscape (Debra, 1920×1080), one is portrait (Avatar, 1080×1920). Set Picture Size to Just Scan / 1:1. At a 1080p feed, physical pixels are much larger than the Lenovos.',
  },
} as const

export type WallPanelDevice = 'lenovo-l24i-4a' | 'tcl-43p615'

/** Measured Mac Studio install: one role per physical display. */
export const MEASURED_WALL_PANELS: Array<{
  role: WallRole
  x: number
  y: number
  width: number
  height: number
  device: WallPanelDevice
  label: string
}> = [
  {
    role: 'code',
    x: -47,
    y: -3338,
    width: 1080,
    height: 1920,
    device: 'lenovo-l24i-4a',
    label: 'Lenovo L24i-4A portrait — top-left code',
  },
  {
    role: 'status',
    x: 1033,
    y: -3000,
    width: 1080,
    height: 1920,
    device: 'lenovo-l24i-4a',
    label: 'Lenovo L24i-4A portrait — top-center status',
  },
  {
    role: 'avatar',
    x: 2113,
    y: -1920,
    width: 1080,
    height: 1920,
    device: 'tcl-43p615',
    label: 'TCL 43P615 portrait — tall right avatar',
  },
  {
    role: 'debra',
    x: -392,
    y: -1080,
    width: 1920,
    height: 1080,
    device: 'tcl-43p615',
    label: 'TCL 43P615 landscape — mid-left Debra (conductor)',
  },
  {
    role: 'copy',
    x: 0,
    y: 0,
    width: 1080,
    height: 1920,
    device: 'lenovo-l24i-4a',
    label: 'Lenovo L24i-4A portrait — bottom copy',
  },
  {
    role: 'guide',
    x: 1080,
    y: 305,
    width: 1920,
    height: 1080,
    device: 'lenovo-l24i-4a',
    label: 'Lenovo L24i-4A landscape — bottom-right guide',
  },
]

export const MEASURED_WALL_BOUNDS = (() => {
  const minX = Math.min(...MEASURED_WALL_PANELS.map((p) => p.x))
  const minY = Math.min(...MEASURED_WALL_PANELS.map((p) => p.y))
  const maxX = Math.max(...MEASURED_WALL_PANELS.map((p) => p.x + p.width))
  const maxY = Math.max(...MEASURED_WALL_PANELS.map((p) => p.y + p.height))
  return {
    wallX: minX,
    wallY: minY,
    wallW: maxX - minX,
    wallH: maxY - minY,
  }
})()

export function measuredPanelForRole(role: WallRole) {
  const panel = MEASURED_WALL_PANELS.find((entry) => entry.role === role)
  if (!panel) return null
  return {
    role: panel.role,
    panelX: panel.x - MEASURED_WALL_BOUNDS.wallX,
    panelY: panel.y - MEASURED_WALL_BOUNDS.wallY,
    panelWidth: panel.width,
    panelHeight: panel.height,
    wallWidth: MEASURED_WALL_BOUNDS.wallW,
    wallHeight: MEASURED_WALL_BOUNDS.wallH,
  }
}
