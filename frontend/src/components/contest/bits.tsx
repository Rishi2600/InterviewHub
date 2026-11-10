// Small pieces shared by the contest pages, matching the approved mockups.
import type { ReactNode } from 'react'
import { Award, Check, CodeXml, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContestPhase } from '@/types'

/** A contest counts toward scores once this many entrants start it. */
export const RATED_AT = 10

const PILL = 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap'

export function PhaseBadge({ phase }: { phase: ContestPhase }) {
  switch (phase) {
    case 'live':
      return (
        <span className={cn(PILL, 'gap-1.5 bg-primary text-primary-foreground')}>
          <span className="size-1.5 rounded-full bg-primary-foreground/70" />
          Live
        </span>
      )
    case 'upcoming':
      return <span className={cn(PILL, 'bg-secondary')}>Upcoming</span>
    case 'draft':
      return <span className={cn(PILL, 'border border-dashed')}>Draft</span>
    case 'cancelled':
      return <span className={cn(PILL, 'border border-danger/40 text-danger')}>Cancelled</span>
    default:
      return <span className={cn(PILL, 'border text-muted-foreground')}>Ended</span>
  }
}

/** Marks a code contest; quiz contests carry no badge. */
export function CodeBadge() {
  return (
    <span className={cn(PILL, 'bg-secondary')}>
      <CodeXml className="size-3" aria-hidden />
      Code
    </span>
  )
}

export function RatedBadge({ rated }: { rated: boolean | null }) {
  if (rated === null) return null
  return rated ? (
    <span className={cn(PILL, 'border border-primary/40 text-brand')}>
      <Award className="size-3" aria-hidden />
      Rated
    </span>
  ) : (
    <span className={cn(PILL, 'border text-muted-foreground')}>Unrated</span>
  )
}

export function JoinedBadge() {
  return (
    <span className={cn(PILL, 'bg-primary/10 text-brand')}>
      <Check className="size-3" aria-hidden />
      Joined
    </span>
  )
}

export function HostingBadge() {
  return (
    <span className={cn(PILL, 'bg-secondary')}>
      <Mic className="size-3" aria-hidden />
      Hosting
    </span>
  )
}

/** Progress towards the starters (or entrants) a contest needs to be rated. */
export function RatedMeter({ n, label = 'starters' }: { n: number; label?: 'starters' | 'entrants' }) {
  const text =
    n >= RATED_AT ? (
      <span className="text-brand">{label === 'starters' ? 'Will be rated' : 'On track to be rated'}</span>
    ) : (
      `${RATED_AT - n} more ${label} to be rated`
    )
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{text}</span>
        <span className="tabular-nums">
          {Math.min(n, RATED_AT)}/{RATED_AT}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (n / RATED_AT) * 100)}%` }} />
      </div>
    </div>
  )
}

/** A bordered panel with an optional header row, as on the mockups. */
export function Panel({
  title,
  extra,
  children,
  className,
}: {
  title?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border bg-card', className)}>
      {title && (
        <div className="flex items-center gap-2 border-b px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * A question prompt. Text in ``` fences shows as code, everything else as
 * paragraphs, so hosts can include short code samples.
 */
export function PromptText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/```[^\n]*\n?/)
  return (
    <div className={cn('grid gap-3', className)}>
      {parts.map((part, i) => {
        if (!part.trim()) return null
        return i % 2 === 1 ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-lg border bg-card p-4 font-mono text-[13px] leading-relaxed font-normal [font-variant-ligatures:none]"
          >
            {part.replace(/\n$/, '')}
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {part.trim()}
          </p>
        )
      })}
    </div>
  )
}

/** A label above a big number, for the stat rows on contest pages. */
export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('py-3', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
