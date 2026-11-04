import { Crown, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/States'
import { UserAvatar } from '@/components/common/UserAvatar'
import { cn, shortId } from '@/lib/utils'

export interface Standing {
  userId: string
  rank: number
  score: number
}

/** Ranked rows with a bar relative to the leader. Used live and for final results. */
export function Leaderboard({
  rows,
  namesByUserId,
  currentUserId,
  isLoading,
  emptyTitle = 'No one on the board yet',
  emptyDescription = 'Scores appear here as soon as participants earn points.',
}: {
  rows: Standing[]
  /** The live board only carries user ids; names come from the contest roster. */
  namesByUserId: Record<string, string>
  currentUserId: string
  isLoading: boolean
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return <EmptyState icon={<Trophy />} title={emptyTitle} description={emptyDescription} />
  }

  const best = Math.max(1, ...rows.map((r) => r.score))
  return (
    <ol className="grid gap-1">
      {rows.map((row) => {
        const name = namesByUserId[row.userId] ?? shortId(row.userId)
        const isYou = row.userId === currentUserId
        return (
          <li
            key={row.userId}
            className={cn(
              'grid grid-cols-[1.5rem_2rem_minmax(0,1fr)_3rem] items-center gap-3 rounded-md px-2 py-2',
              isYou ? 'bg-primary/10' : 'hover:bg-muted/50',
            )}
          >
            <span className="grid place-items-center font-mono text-xs text-muted-foreground">
              {row.rank === 1 ? <Crown className="size-4 text-brand" aria-label="First place" /> : row.rank}
            </span>
            <UserAvatar name={name} />
            <div className="grid min-w-0 gap-1.5">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate">{name}</span>
                {isYou && <Badge variant="secondary">You</Badge>}
              </span>
              <Progress value={(row.score / best) * 100} className="h-1.5" />
            </div>
            {/* Keyed on the score so a change replays the entrance animation. */}
            <span key={row.score} className="text-right font-heading text-lg font-semibold animate-in fade-in zoom-in-95">
              {row.score}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
