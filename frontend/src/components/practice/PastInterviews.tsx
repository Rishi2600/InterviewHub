import { Link } from 'react-router-dom'
import { ChevronRight, Loader2 } from 'lucide-react'
import { EmptyState } from '@/components/common/States'
import { formatDay } from '@/lib/score'
import type { PracticeListItem } from '@/types'
import { KIND_LABEL, LEVEL_LABEL, formatScore } from './labels'

/** A score out of 5 as five small bars, filled by its share of each. */
export function ScoreBars({ score, className = 'w-16' }: { score: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, score - (i - 1)))
        return (
          <span key={i} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${fill * 100}%` }} />
          </span>
        )
      })}
    </span>
  )
}

function ScoreCell({ item }: { item: PracticeListItem }) {
  if (item.status === 'ended') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Writing feedback
      </span>
    )
  }
  if (item.score === null) return <span className="text-xs text-muted-foreground">No feedback</span>
  return (
    <span className="flex items-center justify-end gap-2" title={`${formatScore(item.score)} out of 5`}>
      <span className="tnum font-semibold">{formatScore(item.score)}</span>
      <ScoreBars score={item.score} className="hidden w-16 sm:inline-flex" />
    </span>
  )
}

/** Past interviews, newest first. The chat itself isn't kept, only feedback. */
export function PastInterviews({ items }: { items: PracticeListItem[] }) {
  return (
    <section className="mt-6 overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3.5">
        <h2 className="text-base font-semibold">Past interviews</h2>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">We keep the feedback, not the chat</span>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No practice interviews yet" description="Your feedback from each one shows up here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 pl-5 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Topic</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Type</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Level</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Length</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="relative border-t hover:bg-muted/50">
                  <td className="tnum py-3 pr-3 pl-5 whitespace-nowrap text-muted-foreground">
                    {formatDay(item.startedAt, { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-3 py-3 font-medium">
                    <Link to={`/practice/${item.id}/feedback`} className="after:absolute after:inset-0">
                      {item.topic}
                      {item.mixed && <span className="font-normal text-muted-foreground"> (mixed)</span>}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">{KIND_LABEL[item.kind]}</td>
                  <td className="hidden px-3 py-3 md:table-cell">{LEVEL_LABEL[item.level]}</td>
                  <td className="tnum hidden px-3 py-3 md:table-cell">
                    {item.minutes} min · {item.mode === 'voice' ? 'Voice' : 'Chat'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <ScoreCell item={item} />
                  </td>
                  <td className="py-3 pr-4 pl-2 text-right text-muted-foreground">
                    <ChevronRight className="ml-auto size-4" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
