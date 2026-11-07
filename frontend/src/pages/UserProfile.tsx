import { useParams } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileIdentity } from '@/components/score/ProfileIdentity'
import { ScoreSection } from '@/components/score/ScoreSection'
import { useUserScore } from '@/hooks/useUserScore'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/api'

/** Another user's profile with their score section, for interviewers and admins. */
export function UserProfile() {
  const { id = '' } = useParams()
  const { user: viewer } = useAuth()
  const score = useUserScore(id)
  const user = score.data?.user

  return (
    <>
      <PageHeader title={<span className="truncate font-medium">{user?.username ?? 'Profile'}</span>} />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-6">
        {score.isError ? (
          <ErrorState title="Could not open this profile" message={errorMessage(score.error)} />
        ) : !user ? (
          <Skeleton className="h-16 w-72" />
        ) : (
          <>
            <ProfileIdentity name={user.username} role={user.role} avatarUrl={user.avatarUrl} joinedAt={user.joinedAt} />
            {viewer?.id !== id && (
              <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                <Eye className="size-3.5" aria-hidden />
                Visible to this candidate, interviewers and admins.
              </p>
            )}
            <ScoreSection userId={id} isSelf={viewer?.id === id} />
          </>
        )}
      </div>
    </>
  )
}
