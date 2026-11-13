import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GraduationCap, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatScore, practiceTitle } from '@/components/practice/labels'
import { errorMessage } from '@/lib/api'
import { getPrepHistory } from '@/lib/endpoints'
import { formatDay } from '@/lib/score'
import { cn } from '@/lib/utils'
import type { PrepHistoryItem } from '@/types'

function link(item: PrepHistoryItem) {
  if (item.mode === 'drill') return `/prep/drills/${item.id}`
  return item.status === 'active' ? `/practice/${item.id}` : `/practice/${item.id}/feedback`
}

/** The result on the right: a drill's score, or a coach recap's average. */
function Result({ item }: { item: PrepHistoryItem }) {
  if (item.mode === 'drill') {
    const frac = item.answered ? item.right / item.answered : 0
    return (
      <span className="grid justify-items-end gap-1">
        <span className="text-sm font-semibold tabular-nums">
          {item.status === 'active' ? `${item.answered}/${item.total} answered` : `${item.right}/${item.answered}`}
        </span>
        <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${frac * 100}%` }} />
        </span>
      </span>
    )
  }
  const note =
    item.status === 'active' ? 'Running' : item.status === 'ended' ? 'Recap being written' : item.status === 'failed' ? 'No recap' : null
  if (note || item.score === null) return <span className="text-xs text-muted-foreground">{note ?? '—'}</span>
  return (
    <span className="text-sm font-semibold tabular-nums">
      {formatScore(item.score)}
      <span className="font-normal text-muted-foreground"> / 5</span>
    </span>
  )
}

/** The candidate's drills and coach sessions, newest first. */
export function PrepSessions({ items, nextBefore }: { items: PrepHistoryItem[]; nextBefore: string | null }) {
  const [more, setMore] = useState<PrepHistoryItem[]>([])
  const [next, setNext] = useState(nextBefore)
  const load = useMutation({
    mutationFn: (before: string) => getPrepHistory(before),
    onSuccess: (page) => {
      setMore((m) => [...m, ...page.items])
      setNext(page.nextBefore)
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't load more")),
  })
  const all = [...items, ...more]
  return (
    <section className="mt-8 rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3.5">
        <h2 className="text-base font-semibold">Your drills and coach sessions</h2>
      </div>
      {all.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">Your drills and coach sessions show here.</p>
      ) : (
        <div className="grid p-2 sm:grid-cols-2">
          {all.map((item) => (
            <Link key={`${item.mode}-${item.id}`} to={link(item)} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted">
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-lg',
                  item.mode === 'drill' ? 'bg-primary/15 text-brand' : 'bg-muted',
                )}
              >
                {item.mode === 'drill' ? <ListChecks className="size-4" aria-hidden /> : <GraduationCap className="size-4" aria-hidden />}
              </span>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium">{practiceTitle(item)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {item.mode === 'drill' ? 'Drill' : 'Coach'} · {formatDay(item.startedAt, { day: 'numeric', month: 'short' })}
                </span>
              </span>
              <Result item={item} />
            </Link>
          ))}
        </div>
      )}
      {next && (
        <div className="border-t p-2 text-center">
          <Button variant="ghost" size="sm" disabled={load.isPending} onClick={() => load.mutate(next)}>
            {load.isPending ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      )}
    </section>
  )
}
