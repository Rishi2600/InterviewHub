import { useEffect, useRef } from 'react'
import { Crown, Trophy } from 'lucide-react'
import { Avatar } from '@/components/legacy/Avatar'
import { EmptyState } from '@/components/legacy/States'
import { SkeletonRows } from '@/components/legacy/Skeleton'
import { cn, shortId } from '@/lib/utils'
import type { LeaderboardRow } from '@/types'

/**
 * Only first place is marked, and it is the one sand element on the board.
 * Everything below is a plain mono rank -- restrained, not a podium of
 * medals.
 */
function RankMark({ rank }: { rank: number }) {
  if (rank === 1) return <Crown aria-hidden className="size-3.5 text-sand" />
  return <span className="num text-micro text-ink-faint">{rank}</span>
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
        el.classList.remove('animate-flash')
        void el.offsetWidth // restart the animation
        el.classList.add('animate-flash')
      }
    }
  }, [row.score])

  return (
    <li
      className={cn(
        'flex items-center gap-3 border-t border-line px-2 py-2.5 first:border-t-0',
        'transition-colors duration-[var(--duration-base)] ease-[var(--ease-peaks)]',
        // A tinted row is the only other place sand fill appears.
        isCurrentUser ? 'bg-sand-soft' : 'hover:bg-surface',
      )}
    >
      <span className="grid w-5 shrink-0 place-items-center">
        <RankMark rank={row.rank} />
      </span>

      <Avatar name={name} id={row.userId} size="sm" />

      <span className="min-w-0 flex-1 truncate text-caption text-ink">
        {name}
        {isCurrentUser && <span className="label ml-2 text-sand">you</span>}
      </span>

      <span
        ref={scoreRef}
        className="num rounded-[var(--radius-control)] px-2 py-0.5 text-subheading text-ink"
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
        icon={<Trophy className="size-5" />}
        title="No one on the board yet"
        description="Scores appear here the moment participants join and start earning points."
      />
    )
  }

  return (
    <ol>
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