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

/** Measured Mac Studio install: one role per physical display. */
export const MEASURED_WALL_PANELS: Array<{
  role: WallRole
  x: number
  y: number
  width: number
  height: number
  label: string
}> = [
  {
    role: 'code',
    x: -47,
    y: -3338,
    width: 1080,
    height: 1920,
    label: 'L24i-4A (4) top-left code',
  },
  {
    role: 'status',
    x: 1033,
    y: -3000,
    width: 1080,
    height: 1920,
    label: 'L24i-4A (1) top status',
  },
  {
    role: 'avatar',
    x: 2113,
    y: -1920,
    width: 1080,
    height: 1920,
    label: 'Beyond TV (2) top-right avatar',
  },
  {
    role: 'debra',
    x: -392,
    y: -1080,
    width: 1920,
    height: 1080,
    label: 'Beyond TV (1) mid-left Debra',
  },
  {
    role: 'copy',
    x: 0,
    y: 0,
    width: 1080,
    height: 1920,
    label: 'L24i-4A (2) bottom-left copy',
  },
  {
    role: 'guide',
    x: 1080,
    y: 305,
    width: 1920,
    height: 1080,
    label: 'L24i-4A (3) bottom-right guide arrows',
  },
]
