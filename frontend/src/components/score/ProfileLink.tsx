import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { canSeeScore } from '@/lib/score'
import { cn } from '@/lib/utils'

/** A name that opens the user's profile, for viewers allowed to see it. */
export function ProfileLink({ userId, className, children }: { userId: string; className?: string; children: ReactNode }) {
  const { user } = useAuth()
  if (!canSeeScore(user, userId)) return <span className={className}>{children}</span>
  return (
    <Link to={user?.id === userId ? '/profile' : `/users/${userId}`} className={cn('hover:underline', className)}>
      {children}
    </Link>
  )
}
