import { useId } from 'react'
import { formatDay } from '@/lib/score'

const W = 360
const H = 70
const PAD = 6

/** The score after each rated contest, with a dashed line at the 5.0 start. */
export function TrendLine({ history }: { history: { at: string; score: number }[] }) {
  const fill = useId()
  if (history.length < 2) {
    return <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">The trend shows after two rated contests.</p>
  }
  const points = history.map((h, i) => [PAD + (i / (history.length - 1)) * (W - 2 * PAD), PAD + (1 - h.score / 10) * (H - 2 * PAD)])
  const line = points.map((p) => p.join(',')).join(' ')
  const [lastX, lastY] = points[points.length - 1]
  const mid = H / 2
  return (
    <figure className="grid gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Score trend over ${history.length} rated contests`}>
        <defs>
          <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="1" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line x1={0} x2={W} y1={mid} y2={mid} stroke="currentColor" strokeDasharray="3 4" className="text-muted-foreground/40" />
        <polygon points={`${points[0][0]},${H} ${line} ${lastX},${H}`} fill={`url(#${fill})`} />
        <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastX} cy={lastY} r={3.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground">
        <span>{formatDay(history[0].at, { month: 'short', year: 'numeric' })}</span>
        <span>dashed line = 5.0 start</span>
        <span>now</span>
      </figcaption>
    </figure>
  )
}
