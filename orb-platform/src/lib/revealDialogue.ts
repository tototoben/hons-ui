import { useEffect, useState } from 'react'

export type RevealDialoguePhase =
  | 'idle'
  | 'intro'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'mirroring'
  | 'closing'
  | 'ended'
  | 'error'

export type RevealDialogueDetail = {
  key: string
  value: string
  learned_turn: number
}

export type RevealDialogueState = {
  session_id: string | null
  visit_id: string | null
  phase: RevealDialoguePhase
  turn: number
  assistant_text: string
  visitor_text: string
  details: RevealDialogueDetail[]
  detail_count: number
  archetypes: Record<string, string>
  mirror_intensity: number
  mic_level: number
  audio_input: string
  audio_output: string
  error: string
}

export const EMPTY_REVEAL_DIALOGUE: RevealDialogueState = {
  session_id: null,
  visit_id: null,
  phase: 'idle',
  turn: 0,
  assistant_text: '',
  visitor_text: '',
  details: [],
  detail_count: 0,
  archetypes: {},
  mirror_intensity: 0,
  mic_level: 0,
  audio_input: '',
  audio_output: '',
  error: '',
}

const PHASES = new Set<RevealDialoguePhase>([
  'idle',
  'intro',
  'listening',
  'thinking',
  'speaking',
  'mirroring',
  'closing',
  'ended',
  'error',
])

const EVENT_NAMES = ['state', 'level', 'session_started', 'error'] as const

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeRevealDialogue(value: unknown): RevealDialogueState {
  if (!value || typeof value !== 'object') return EMPTY_REVEAL_DIALOGUE
  const raw = value as Record<string, unknown>
  const rawPhase = text(raw.phase) as RevealDialoguePhase
  const details = Array.isArray(raw.details)
    ? raw.details.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const detail = entry as Record<string, unknown>
        const key = text(detail.key)
        const detailValue = text(detail.value)
        if (!key || !detailValue) return []
        return [{ key, value: detailValue, learned_turn: finite(detail.learned_turn) }]
      })
    : []
  const rawArchetypes = raw.archetypes
  const archetypes: Record<string, string> = {}
  if (rawArchetypes && typeof rawArchetypes === 'object') {
    for (const [key, value] of Object.entries(rawArchetypes)) {
      if (typeof value === 'string') archetypes[key] = value
    }
  }
  return {
    session_id: text(raw.session_id) || null,
    visit_id: text(raw.visit_id) || null,
    phase: PHASES.has(rawPhase) ? rawPhase : 'idle',
    turn: finite(raw.turn),
    assistant_text: text(raw.assistant_text),
    visitor_text: text(raw.visitor_text),
    details,
    detail_count: finite(raw.detail_count, details.length),
    archetypes,
    mirror_intensity: Math.max(0, Math.min(1, finite(raw.mirror_intensity))),
    mic_level: Math.max(0, Math.min(1, finite(raw.mic_level))),
    audio_input: text(raw.audio_input),
    audio_output: text(raw.audio_output),
    error: text(raw.error),
  }
}

const LIVE_PHASES = new Set<RevealDialoguePhase>([
  'intro',
  'listening',
  'thinking',
  'speaking',
  'mirroring',
  'closing',
])

/**
 * The dialogue takes over the wall only while a session is live.  The
 * service being reachable is not enough: it runs all day, and an idle or
 * finished session would otherwise hide the photobash wall indefinitely.
 */
export function dialogueOwnsWall(available: boolean, state: RevealDialogueState): boolean {
  return available && LIVE_PHASES.has(state.phase)
}

export function revealDialogueTarget(search = window.location.search): string | null {
  const explicit = new URLSearchParams(search).get('dialogue')
  if (explicit === '0' || explicit === 'false') return null
  if (explicit) return explicit.replace(/\/$/, '')
  return 'http://127.0.0.1:8191'
}

export function useRevealDialogue() {
  const [state, setState] = useState<RevealDialogueState>(EMPTY_REVEAL_DIALOGUE)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const target = revealDialogueTarget()
    if (!target) return
    let closed = false
    const apply = (value: unknown) => {
      if (closed) return
      setState(normalizeRevealDialogue(value))
      setAvailable(true)
    }

    void fetch(`${target}/api/state`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`dialogue state ${response.status}`)
        return response.json()
      })
      .then(apply)
      .catch(() => {
        if (!closed) setAvailable(false)
      })

    const source = new EventSource(`${target}/api/events`)
    const receive = (event: Event) => {
      try {
        apply(JSON.parse((event as MessageEvent<string>).data))
      } catch {
        // Ignore a malformed frame; the next full snapshot repairs state.
      }
    }
    for (const name of EVENT_NAMES) source.addEventListener(name, receive)
    source.onopen = () => setAvailable(true)
    source.onerror = () => setAvailable(false)
    return () => {
      closed = true
      for (const name of EVENT_NAMES) source.removeEventListener(name, receive)
      source.close()
    }
  }, [])

  return { state, available }
}
