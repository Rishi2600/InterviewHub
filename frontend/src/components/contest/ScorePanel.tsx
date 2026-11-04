import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/legacy/Button'
import { Avatar } from '@/components/legacy/Avatar'
import { EmptyState } from '@/components/legacy/States'
import type { ContestEntry } from '@/types'

const QUICK_DELTAS = [1, 5, 10]

/**
 * Host-only scoring controls, one row per participant. Scoring is fire-and-
 * forget from the UI's perspective: the authoritative new score arrives back
 * over the leaderboard socket.
 */
export function ScorePanel({
  entries,
  onScore,
  pendingUserId,
  disabled,
  disabledReason,
}: {
  entries: ContestEntry[]
  onScore: (userId: string, delta: number) => void
  pendingUserId: string | null
  disabled: boolean
  disabledReason?: string
}) {
  const [customDelta, setCustomDelta] = useState('')

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No participants yet"
        description="People who join the contest will appear here for scoring."
        className="border-0 py-8"
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {disabled && disabledReason && (
        <p className="border-l-2 border-line-strong bg-surface px-3 py-2 text-micro text-ink-muted">
          {disabledReason}
        </p>
      )}

      <div className="flex items-center gap-2">
        <label htmlFor="custom-delta" className="label">
          Custom points
        </label>
        <input
          id="custom-delta"
          type="number"
          inputMode="numeric"
          value={customDelta}
          onChange={(e) => setCustomDelta(e.target.value)}
          placeholder="e.g. 25"
          disabled={disabled}
          className="num h-8 w-24 rounded-[var(--radius-control)] border border-line bg-surface px-2 text-caption text-ink transition-colors duration-[var(--duration-fast)] hover:border-line-strong focus:border-line-strong disabled:text-ink-disabled"
        />
      </div>

      <ul>
        {entries.map((entry) => {
          const isPending = pendingUserId === entry.userId
          const custom = Number(customDelta)
          const hasCustom = customDelta.trim() !== '' && Number.isFinite(custom) && custom !== 0

          return (
            <li
              key={entry.userId}
              className="flex flex-wrap items-center gap-2 border-t border-line px-2 py-2.5 first:border-t-0"
            >
              <Avatar name={entry.username} id={entry.userId} size="sm" />
              <span className="min-w-0 flex-1 truncate text-caption text-ink">
                {entry.username}
              </span>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled || isPending}
                  onClick={() => onScore(entry.userId, -1)}
                  aria-label={`Subtract 1 point from ${entry.username}`}
                >
                  <Minus className="size-3.5" aria-hidden />
                </Button>

                {QUICK_DELTAS.map((delta) => (
                  <Button
                    key={delta}
                    size="sm"
                    variant="secondary"
                    disabled={disabled || isPending}
                    onClick={() => onScore(entry.userId, delta)}
                    aria-label={`Add ${delta} points to ${entry.username}`}
                  >
                    <Plus className="size-3 opacity-60" aria-hidden />
                    <span className="num">{delta}</span>
                  </Button>
                ))}

                {hasCustom && (
                  <Button
                    size="sm"
                    disabled={disabled || isPending}
                    isLoading={isPending}
                    onClick={() => onScore(entry.userId, custom)}
                    aria-label={`Add ${custom} points to ${entry.username}`}
                  >
                    <span className="num">{custom > 0 ? `+${custom}` : custom}</span>
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}