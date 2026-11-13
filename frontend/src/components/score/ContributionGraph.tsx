import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getUserActivity } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { buildGraph, describeKinds, formatDay } from '@/lib/score'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const CELL = 11
const STEP = 14
const LEFT = 30
const TOP = 18
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
// Size every range for a full year, so a year that ends today keeps the same square size.
const MIN_WEEKS = 53

/** GitHub-style activity squares: the last 12 months, or a chosen year. */
export function ContributionGraph({ userId }: { userId: string }) {
  const [year, setYear] = useState<number | undefined>()
  const activity = useQuery({
    queryKey: ['users', userId, 'activity', year ?? 'last'],
    queryFn: () => getUserActivity(userId, year),
  })
  const graph = useMemo(() => activity.data && buildGraph(activity.data.from, activity.data.to, activity.data.days), [activity.data])

  const choices: [number | undefined, string][] = [[undefined, 'Last 12 months'], ...(activity.data?.years ?? []).map((y): [number, string] => [y, String(y)])]
  const total = activity.data?.total ?? 0

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{total}</span> {total === 1 ? 'activity' : 'activities'}{' '}
          {year ? `in ${year}` : 'in the last 12 months'}
        </p>
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-0.5" role="group" aria-label="Range">
          {choices.map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setYear(value)}
              aria-pressed={year === value}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium',
                year === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activity.isError ? (
        <p className="text-sm text-danger">{errorMessage(activity.error, 'Could not load activity')}</p>
      ) : !graph ? (
        <Skeleton className="h-[116px] w-full" />
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${LEFT + Math.max(MIN_WEEKS, graph.weeks.length) * STEP} ${TOP + 7 * STEP}`}
            className="w-full min-w-[680px] text-muted-foreground"
            role="img"
            aria-label={`${total} activities, one square per day`}
          >
            {graph.months.map((m) => (
              <text key={`${m.label}-${m.week}`} x={LEFT + m.week * STEP} y={10} className="fill-current text-[10px]">
                {m.label}
              </text>
            ))}
            {DAY_LABELS.map((label, d) =>
              label ? (
                <text key={label} x={0} y={TOP + d * STEP + 9} className="fill-current text-[10px]">
                  {label}
                </text>
              ) : null,
            )}
            {graph.weeks.map((week, w) =>
              week.map((cell, d) =>
                cell ? (
                  <rect
                    key={cell.date}
                    x={LEFT + w * STEP}
                    y={TOP + d * STEP}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    style={{ fill: `var(--graph-${cell.level})` }}
                  >
                    <title>
                      {formatDay(cell.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}:{' '}
                      {cell.count ? describeKinds(cell.kinds) || `${cell.count} activities` : 'nothing'}
                    </title>
                  </rect>
                ) : null,
              ),
            )}
          </svg>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Contests, interviews, practice interviews and prep.</span>
        <span className="flex items-center gap-1" aria-hidden>
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="size-[11px] rounded-[2px]" style={{ background: `var(--graph-${l})` }} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}
