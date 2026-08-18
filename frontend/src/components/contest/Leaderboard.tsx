import { useEffect, useRef } from 'react'
import { Crown, Medal, Trophy } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/States'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { cn, shortId } from '@/lib/utils'
import type { LeaderboardRow } from '@/types'

/** Podium treatment for the top three; plain rank number after that. */
function RankMark({ rank }: { rank: number }) {
  if (rank === 1) return <Crown aria-hidden className="size-4 text-warning" />
  if (rank === 2) return <Medal aria-hidden className="size-4 text-ink-muted" />
  if (rank === 3) return <Medal aria-hidden className="size-4 text-danger" />
  return <span className="text-caption tabular-nums text-ink-faint">{rank}</span>
}

function Row({
  row,
  name,
  isCurrentUser,
}: {
  row: LeaderboardRow
  name: string
  isCurrentUser: boolean
}) {
  const scoreRef = useRef<HTMLSpanElement>(null)
  const prevScore = useRef(row.score)

  // Flash the score when it changes, so a live update is visible even if the
  // row's position doesn't move.
  useEffect(() => {
    if (prevScore.current !== row.score) {
      const el = scoreRef.current
      prevScore.current = row.score
      if (el) {
        el.classList.remove('animate-pulse-once')
        void el.offsetWidth // restart the animation
        el.classList.add('animate-pulse-once')
      }
    }
  }, [row.score])

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2.5',
        'transition-all duration-200 ease-[var(--ease-out-soft)]',
        isCurrentUser
          ? 'border-accent/50 bg-accent-soft/30'
          : 'border-transparent bg-surface-raised hover:border-line',
      )}
    >
      <span className="grid w-6 shrink-0 place-items-center">
        <RankMark rank={row.rank} />
      </span>

      <Avatar name={name} id={row.userId} size="sm" />

      <span className="min-w-0 flex-1 truncate text-body text-ink">
        {name}
        {isCurrentUser && <span className="ml-1.5 text-caption text-accent">you</span>}
      </span>

      <span
        ref={scoreRef}
        className="rounded-[var(--radius-control)] px-2 py-0.5 text-subheading font-semibold tabular-nums text-ink"
      >
        {row.score}
      </span>
    </li>
  )
}

export function Leaderboard({
  rows,
  namesByUserId,
  currentUserId,
  isLoading,
}: {
  rows: LeaderboardRow[]
  /** The board only carries user ids — names come from the contest roster. */
  namesByUserId: Record<string, string>
  currentUserId: string
  isLoading: boolean
}) {
  if (isLoading) return <SkeletonRows rows={5} />

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="size-7" />}
        title="No one on the board yet"
        description="Scores appear here the moment participants join and start earning points."
        className="border-0"
      />
    )
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <Row
          key={row.userId}
          row={row}
          name={namesByUserId[row.userId] ?? shortId(row.userId)}
          isCurrentUser={row.userId === currentUserId}
        />
      ))}
    </ol>
  )
}