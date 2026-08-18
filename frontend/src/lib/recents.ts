/**
 * Local "recently visited" index.
 *
 * The backend exposes no list endpoints — rooms and contests are only
 * reachable by id (or by join code). Without something like this, a user who
 * closes the tab loses the way back into a room they created. So we remember
 * what they've touched, per user, in localStorage.
 *
 * This is a client-side convenience, not a source of truth: entries are a
 * cached label + id, and the real document is always re-fetched on open.
 */

export type RecentKind = 'room' | 'contest'

export interface RecentItem {
  kind: RecentKind
  id: string
  title: string
  /** Room join code, when the entry is a room. */
  code?: string
  visitedAt: string
}

const MAX_ITEMS = 12

function keyFor(userId: string): string {
  return `interviewhub.recents.${userId}`
}

export function getRecents(userId: string, kind?: RecentKind): RecentItem[] {
  const raw = localStorage.getItem(keyFor(userId))
  if (!raw) return []
  try {
    const all = JSON.parse(raw) as RecentItem[]
    const list = Array.isArray(all) ? all : []
    return kind ? list.filter((i) => i.kind === kind) : list
  } catch {
    localStorage.removeItem(keyFor(userId))
    return []
  }
}

export function rememberRecent(
  userId: string,
  item: Omit<RecentItem, 'visitedAt'>,
): RecentItem[] {
  const existing = getRecents(userId).filter(
    (i) => !(i.kind === item.kind && i.id === item.id),
  )
  const next = [{ ...item, visitedAt: new Date().toISOString() }, ...existing].slice(
    0,
    MAX_ITEMS,
  )
  localStorage.setItem(keyFor(userId), JSON.stringify(next))
  return next
}

export function forgetRecent(
  userId: string,
  kind: RecentKind,
  id: string,
): RecentItem[] {
  const next = getRecents(userId).filter((i) => !(i.kind === kind && i.id === id))
  localStorage.setItem(keyFor(userId), JSON.stringify(next))
  return next
}