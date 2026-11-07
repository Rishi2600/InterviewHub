import type { ReactNode } from 'react'
import { UserAvatar } from '@/components/common/UserAvatar'
import { formatDay } from '@/lib/score'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

// oxlint-disable-next-line react/only-export-components -- shared labels
export const ROLE: Record<Role, string> = { candidate: 'Candidate', interviewer: 'Interviewer', admin: 'Admin' }

/** Picture, name, role and join date across the top of a profile. */
export function ProfileIdentity({
  name,
  role,
  avatarUrl,
  joinedAt,
  dimmed,
  action,
}: {
  name: string
  role: Role
  avatarUrl?: string | null
  joinedAt?: string
  dimmed?: boolean
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <UserAvatar name={name} src={avatarUrl} size="lg" className={cn(dimmed && 'opacity-60')} />
      <div className="grid gap-0.5">
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="text-sm text-muted-foreground">
          {ROLE[role]}
          {joinedAt && ` · joined ${formatDay(joinedAt, { month: 'short', year: 'numeric' })}`}
        </p>
      </div>
      {action && <div className="sm:ml-auto">{action}</div>}
    </div>
  )
}
