import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/common/States'
import { UserAvatar } from '@/components/common/UserAvatar'
import type { ContestEntry } from '@/types'

const QUICK_DELTAS = [1, 5, 10]

/**
 * Host-only scoring, one row per participant. The new score comes back over
 * the leaderboard socket, so nothing here updates the board itself.
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
  const custom = Number(customDelta)
  const hasCustom = customDelta.trim() !== '' && Number.isInteger(custom) && custom !== 0

  if (entries.length === 0) {
    return (
      <EmptyState
        className="py-6"
        title="No participants yet"
        description="People who join the contest appear here for scoring."
      />
    )
  }

  return (
    <div className="grid gap-4">
      {disabled && disabledReason && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{disabledReason}</p>
      )}
      <div className="grid gap-2">
        <Label htmlFor="custom-delta">Custom points</Label>
        <Input
          id="custom-delta"
          type="number"
          inputMode="numeric"
          value={customDelta}
          onChange={(e) => setCustomDelta(e.target.value)}
          placeholder="e.g. 25 or -5"
          disabled={disabled}
        />
      </div>
      <ul className="grid gap-3">
        {entries.map((entry) => {
          const busy = disabled || pendingUserId === entry.userId
          return (
            <li key={entry.userId} className="grid gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <UserAvatar name={entry.username} size="sm" />
                <span className="truncate">{entry.username}</span>
              </span>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onScore(entry.userId, -1)}
                  aria-label={`Subtract 1 point from ${entry.username}`}
                >
                  <Minus aria-hidden />1
                </Button>
                {QUICK_DELTAS.map((delta) => (
                  <Button
                    key={delta}
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onScore(entry.userId, delta)}
                    aria-label={`Add ${delta} points to ${entry.username}`}
                  >
                    <Plus aria-hidden />
                    {delta}
                  </Button>
                ))}
                {hasCustom && (
                  <Button
                    size="xs"
                    disabled={busy}
                    onClick={() => onScore(entry.userId, custom)}
                    aria-label={`Add ${custom} points to ${entry.username}`}
                  >
                    {custom > 0 ? `+${custom}` : custom}
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
