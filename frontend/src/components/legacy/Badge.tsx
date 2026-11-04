import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ContestState, Role, RoomState } from '@/types'

type Tone = 'neutral' | 'live' | 'success' | 'warning' | 'danger' | 'baseline'

/**
 * Badges carry the label style -- mono, uppercase, tracked -- because labels
 * are the only uppercase in this UI. `live` is sand and is reserved for
 * genuinely live state.
 */
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface text-ink-muted',
  live: 'bg-sand-soft text-sand',
  success: 'bg-surface text-sage',
  warning: 'bg-surface text-wheat',
  danger: 'bg-surface text-clay',
  baseline: 'bg-surface text-taupe',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot = false,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'label inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-1.5 py-1',
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            'size-1.5 rounded-[var(--radius-pill)] bg-current',
            tone === 'live' && 'animate-[var(--animate-live)]',
          )}
        />
      )}
      {children}
    </span>
  )
}

const ROOM_TONES: Record<RoomState, Tone> = {
  waiting: 'warning',
  active: 'live',
  ended: 'neutral',
}

export function RoomStateBadge({ state }: { state: RoomState }) {
  return (
    <Badge tone={ROOM_TONES[state]} dot={state === 'active'}>
      {state}
    </Badge>
  )
}

const CONTEST_TONES: Record<ContestState, Tone> = {
  draft: 'neutral',
  active: 'live',
  ended: 'neutral',
}

export function ContestStateBadge({ state }: { state: ContestState }) {
  return (
    <Badge tone={CONTEST_TONES[state]} dot={state === 'active'}>
      {state}
    </Badge>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={role === 'candidate' ? 'neutral' : 'baseline'}>{role}</Badge>
}
