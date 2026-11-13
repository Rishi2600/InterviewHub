import type { BadgeId, Role } from '@/types'

const DAY = 86_400_000

/** Who may open a candidate's score: themselves, interviewers and admins. */
export function canSeeScore(viewer: { id: string; role: Role } | null, userId: string): boolean {
  if (!viewer) return false
  return viewer.id === userId || viewer.role === 'interviewer' || viewer.role === 'admin'
}

export interface GraphCell {
  date: string
  count: number
  // 0 for none, then 1 to 4 for more.
  level: number
  // Count per kind of activity, when the day has any.
  kinds?: Record<string, number>
}

export interface Graph {
  // One column per week, Sunday to Saturday; null outside the range.
  weeks: (GraphCell | null)[][]
  // Week column where each month's label goes.
  months: { label: string; week: number }[]
}

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`)
const toDate = (t: number) => new Date(t).toISOString().slice(0, 10)

/**
 * Lays the days from `from` to `to` (YYYY-MM-DD, UTC) out as GitHub does:
 * week columns starting on Sunday, with a month label over the first column
 * that starts in that month.
 */
export function buildGraph(
  from: string,
  to: string,
  days: { date: string; count: number; kinds?: Record<string, number> }[],
): Graph {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const start = toTime(from)
  const end = toTime(to)
  const firstSunday = start - new Date(start).getUTCDay() * DAY
  const weeks: (GraphCell | null)[][] = []
  const months: Graph['months'] = []
  let lastMonth = -1
  for (let w = firstSunday; w <= end; w += 7 * DAY) {
    const column: (GraphCell | null)[] = []
    for (let d = 0; d < 7; d++) {
      const t = w + d * DAY
      if (t < start || t > end) {
        column.push(null)
        continue
      }
      const date = toDate(t)
      const day = byDate.get(date)
      const count = day?.count ?? 0
      column.push({ date, count, level: Math.min(4, count), ...(day?.kinds && { kinds: day.kinds }) })
    }
    // Label a month on the week its first shown day falls in.
    const firstShown = Math.max(w, start)
    const month = new Date(firstShown).getUTCMonth()
    if (month !== lastMonth) {
      months.push({ label: new Date(firstShown).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }), week: weeks.length })
      lastMonth = month
    }
    weeks.push(column)
  }
  // Drop a label squeezed into the last two columns, as it would overflow.
  if (months.length > 1 && months[months.length - 1].week > weeks.length - 3) months.pop()
  return { weeks, months }
}

export interface BadgeInfo {
  name: string
  rule: string
  hue: string
}

export const BADGE_INFO: Record<BadgeId, BadgeInfo> = {
  'first-rated': { name: 'First rated', rule: 'Started a first rated contest', hue: '#14c8b4' },
  winner: { name: 'Winner', rule: 'Finished 1st in a rated contest', hue: '#d99a0b' },
  podium: { name: 'Podium', rule: 'Finished in the top 3 of a rated contest', hue: '#c0632e' },
  'top-10': { name: 'Top 10%', rule: 'Ahead of 90% of starters in a rated contest', hue: '#0b7f72' },
  finisher: { name: 'Finisher', rule: 'Pressed Submit in 10 contests', hue: '#4f6bd8' },
  regular: { name: 'Regular', rule: 'Took part in 10 rated contests', hue: '#525252' },
  streak: { name: 'Streak', rule: 'Started a contest 4 weeks running', hue: '#e8590c' },
}

/** "+0.3", "−0.2" or "±0.0", from a change rounded to one decimal. */
export function formatChange(change: number): string {
  const rounded = Math.round(change * 10) / 10
  if (rounded === 0) return '±0.0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' })
}

const KIND_NAMES: Record<string, [string, string]> = {
  contest: ['contest', 'contests'],
  interview: ['live interview', 'live interviews'],
  dummy: ['practice interview', 'practice interviews'],
  prep: ['prep session', 'prep sessions'],
}

/** "2 contests, 1 prep session" for a graph day. */
export function describeKinds(kinds: Record<string, number> | undefined): string {
  if (!kinds) return ''
  return Object.entries(KIND_NAMES)
    .filter(([k]) => kinds[k])
    .map(([k, [one, many]]) => `${kinds[k]} ${kinds[k] === 1 ? one : many}`)
    .join(', ')
}
