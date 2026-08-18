import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ContestState, Role, RoomState } from '@/types'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-raised text-ink-muted border-line',
  accent: 'bg-accent-soft text-ink border-accent/40',
  success: 'bg-success-soft text-success border-success/40',
  warning: 'bg-warning-soft text-warning border-warning/40',
  danger: 'bg-danger-soft text-danger border-danger/40',
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-micro font-medium uppercase tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

const ROOM_TONES: Record<RoomState, Tone> = {
  waiting: 'warning',
  active: 'success',
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
  active: 'success',
  ended: 'danger',
}

export function ContestStateBadge({ state }: { state: ContestState }) {
  return (
    <Badge tone={CONTEST_TONES[state]} dot={state === 'active'}>
      {state}
    </Badge>
  )
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={role === 'candidate' ? 'neutral' : 'accent'}>{role}</Badge>
}