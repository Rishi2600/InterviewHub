import { Users } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'
import { formatDateTime } from '@/lib/utils'
import type { Participant } from '@/types'

export function ParticipantsList({
  participants,
  ownerId,
  currentUserId,
}: {
  participants: Participant[]
  ownerId: string
  currentUserId: string
}) {
  if (participants.length === 0) {
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        title="No one has joined yet"
        description="Share the room code to invite people."
        className="border-0 py-8"
      />
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {participants.map((p) => (
        <li
          key={p.userId}
          className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 transition-colors hover:bg-surface-raised"
        >
          <Avatar name={p.username} id={p.userId} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption font-medium text-ink">
              {p.username}
              {p.userId === currentUserId && (
                <span className="ml-1 text-ink-faint">(you)</span>
              )}
            </p>
            <p className="text-micro text-ink-faint">joined {formatDateTime(p.joinedAt)}</p>
          </div>
          {p.userId === ownerId ? <RoleBadge role="interviewer" /> : <RoleBadge role={p.role} />}
        </li>
      ))}
    </ul>
  )
}