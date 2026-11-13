import { UserAvatar } from '@/components/common/UserAvatar'
import { KIND_LABEL } from '@/components/practice/labels'
import { formatDay } from '@/lib/score'
import { cn } from '@/lib/utils'
import type { ReviewArea } from '@/types'

/** Five short bars, `score` of them filled. */
export function ScoreBars({ score }: { score: number }) {
  return (
    <span className="flex flex-1 gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= score ? 'bg-primary' : 'bg-muted')} />
      ))}
    </span>
  )
}

/** A review as its candidate sees it. */
export function ReviewView({
  review,
  showHeading = true,
}: {
  review: {
    reviewerName: string
    roomTitle: string
    kind: 'technical' | 'behavioural'
    topics: string[]
    areas: ReviewArea[]
    note: string
    updatedAt?: string
  }
  showHeading?: boolean
}) {
  return (
    <div className="grid gap-4">
      {showHeading && (
        <div className="flex items-center gap-2">
          <UserAvatar name={review.reviewerName} />
          <div className="grid leading-tight">
            <span className="text-sm font-medium">Review from {review.reviewerName}</span>
            <span className="text-xs text-muted-foreground">
              {review.roomTitle}
              {review.updatedAt && ` · ${formatDay(review.updatedAt, { day: 'numeric', month: 'short' })}`} · {KIND_LABEL[review.kind]}
            </span>
          </div>
        </div>
      )}
      {review.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {review.topics.map((t) => (
            <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="grid gap-2">
        {review.areas.map((a) => (
          <div key={a.name} className="flex items-center gap-3 text-sm">
            <span className={cn('w-32 shrink-0', a.score <= 2 && 'text-danger')}>{a.name}</span>
            <ScoreBars score={a.score} />
            <span className="w-8 text-right text-muted-foreground tabular-nums">{a.score}/5</span>
          </div>
        ))}
        {review.areas.length === 0 && <p className="text-sm text-muted-foreground">No areas rated yet.</p>}
      </div>
      {review.note && <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm whitespace-pre-line">“{review.note}”</p>}
    </div>
  )
}
