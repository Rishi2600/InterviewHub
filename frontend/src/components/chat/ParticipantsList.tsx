import { Users } from 'lucide-react'
import { Avatar } from '@/components/legacy/Avatar'
import { RoleBadge } from '@/components/legacy/Badge'
import { EmptyState } from '@/components/legacy/States'
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
        icon={<Users className="size-5" />}
        title="No one has joined yet"
        description="Share the room code to invite people."
      />
    )
  }

  return (
    <ul>
      {participants.map((p) => (
        <li
          key={p.userId}
          className="flex items-center gap-2.5 border-t border-line px-1 py-2.5 transition-colors duration-[var(--duration-fast)] first:border-t-0 hover:bg-surface"
        >
          <Avatar name={p.username} id={p.userId} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption text-ink">
              {p.username}
              {p.userId === currentUserId && <span className="ml-1 text-ink-faint">(you)</span>}
            </p>
            <p className="num text-micro text-ink-faint">
              joined {formatDateTime(p.joinedAt)}
            </p>
          </div>
          {p.userId === ownerId ? <RoleBadge role="interviewer" /> : <RoleBadge role={p.role} />}
        </li>
      ))}
    </ul>
  )
}