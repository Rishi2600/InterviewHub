import { TrendingDown, TrendingUp } from 'lucide-react'
import { formatDay } from '@/lib/score'
import type { PracticeListItem } from '@/types'
import { formatScore, practiceTitle } from './labels'

// The last this many scored interviews.
const SHOWN = 12

/**
 * Practice scores over time, one series out of 5, so no legend: the title
 * names it. Each point has a hover title with its topic and level. A
 * narrower drawing on phones keeps the labels readable.
 */
export function ScoreChart({ items }: { items: PracticeListItem[] }) {
  const scored = items.filter((i) => i.score !== null).slice(0, SHOWN).reverse()
  if (scored.length < 2) {
    return (
      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">Your practice scores</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your trend shows here after two interviews with feedback.</p>
      </section>
    )
  }
  const first = scored[0]
  const latest = scored[scored.length - 1]
  const change = (latest.score ?? 0) - (first.score ?? 0)
  const Trend = change >= 0 ? TrendingUp : TrendingDown
  return (
    <section className="mt-6 grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Your practice scores</h2>
          <span className="text-xs text-muted-foreground">out of 5</span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="tnum font-heading text-3xl font-semibold">{formatScore(latest.score ?? 0)}</span>
          <span className="inline-flex items-center gap-1 text-sm text-brand">
            <Trend className="size-3.5" aria-hidden />
            {change >= 0 ? '+' : ''}
            {formatScore(change)} since {formatDay(first.startedAt, { day: 'numeric', month: 'short' })}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Your last {scored.length} practice interviews. Hover a point for the details.
        </p>
      </div>
      <div className="hidden sm:block">
        <Plot points={scored} width={560} height={150} />
      </div>
      <div className="sm:hidden">
        <Plot points={scored} width={300} height={120} />
      </div>
    </section>
  )
}

function Plot({ points, width: W, height: H }: { points: PracticeListItem[]; width: number; height: number }) {
  const top = 10
  const left = 20
  const right = 24
  const bottom = 24
  const x = (i: number) => left + (i * (W - left - right)) / Math.max(1, points.length - 1)
  const y = (s: number) => H - bottom - ((s - 1) / 4) * (H - bottom - top)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score ?? 1).toFixed(1)}`).join(' ')
  // Date labels on every point when they fit, else on every other one.
  const every = points.length > W / 70 ? 2 : 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Practice scores over time">
      {[1, 3, 5].map((s) => (
        <g key={s}>
          <line x1={left} x2={W - right} y1={y(s)} y2={y(s)} stroke="var(--border)" strokeWidth={1} />
          <text x={0} y={y(s) + 3} fontSize={10} fill="var(--muted-foreground)">
            {s}
          </text>
        </g>
      ))}
      {points.map((p, i) =>
        i % every === 0 || i === points.length - 1 ? (
          <text key={p.id} x={x(i)} y={H - 4} fontSize={10} textAnchor="middle" fill="var(--muted-foreground)">
            {formatDay(p.startedAt, { day: 'numeric', month: 'short' })}
          </text>
        ) : null,
      )}
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.id}>
          <title>{`${formatDay(p.startedAt, { day: 'numeric', month: 'short' })}: ${formatScore(p.score ?? 0)} (${practiceTitle(p)})`}</title>
          <circle cx={x(i)} cy={y(p.score ?? 1)} r={12} fill="transparent" />
          <circle cx={x(i)} cy={y(p.score ?? 1)} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
        </g>
      ))}
    </svg>
  )
}
