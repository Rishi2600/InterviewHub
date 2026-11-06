// Times on contest pages, always in the viewer's own time zone.

const MIN = 60_000

/** "19:30" */
export function clock(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** "Thu 5 Nov" */
export function shortDay(iso: string | Date): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "Thursday 5 November" */
export function longDay(iso: string | Date): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "Today", "Tomorrow", or the weekday within a week, else the short date. */
export function dayLabel(iso: string | Date, now: number): string {
  const day = (t: number) => new Date(t).setHours(0, 0, 0, 0)
  const diff = Math.round((day(new Date(iso).getTime()) - day(now)) / (24 * 60 * MIN))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return new Date(iso).toLocaleDateString([], { weekday: 'long' })
  return shortDay(iso)
}

/** "45 min", "2 h", "1 h 30 min" */
export function length(minutes: number | null): string {
  if (!minutes) return '–'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** A countdown: "1:19:42" or "22:14". Never negative. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** "in 15 min", "in 1 h 20 min", "in 3 days" */
export function startsIn(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MIN))
  if (minutes < 60) return `in ${minutes} min`
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m && h < 6 ? `in ${h} h ${m} min` : `in ${h} h`
  }
  const days = Math.round(minutes / (24 * 60))
  return days === 1 ? 'in 1 day' : `in ${days} days`
}

/** Time used on a result: "28:12" or "1:02:05". */
export function timeUsed(ms: number | null): string {
  return ms === null ? '–' : countdown(ms)
}

/** "yyyy-mm-dd" and "hh:mm" for date and time inputs, in local time. */
export function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toTimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Local date and time inputs back to an ISO instant, or null if incomplete. */
export function fromInputs(date: string, time: string): string | null {
  if (!date || !time) return null
  const d = new Date(`${date}T${time}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** The viewer's time zone, e.g. "IST", for "Times are in your time zone". */
export function zoneName(): string {
  const part = new Intl.DateTimeFormat([], { timeZoneName: 'short' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? 'local time'
}
