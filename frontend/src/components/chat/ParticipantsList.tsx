import { Users } from 'lucide-react'
import { UserAvatar } from '@/components/common/UserAvatar'
import { EmptyState } from '@/components/common/States'
import { ProfileLink } from '@/components/score/ProfileLink'
import type { Participant } from '@/types'

const ROLE = { candidate: 'Candidate', interviewer: 'Interviewer', admin: 'Admin' } as const

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
        className="py-6"
        icon={<Users />}
        title="No one has joined yet"
        description="Share the join code to invite people."
      />
    )
  }

  return (
    <ul className="grid gap-3">
      {participants.map((p) => (
        <li key={p.userId} className="flex items-center gap-2.5">
          <UserAvatar name={p.username} />
          <div className="grid min-w-0 leading-tight">
            <ProfileLink userId={p.userId} className="truncate text-sm font-medium">
              {p.username}
              {p.userId === currentUserId && <span className="font-normal text-muted-foreground"> (you)</span>}
            </ProfileLink>
            <span className="truncate text-xs text-muted-foreground">
              {ROLE[p.role]}
              {p.userId === ownerId && ', room owner'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
