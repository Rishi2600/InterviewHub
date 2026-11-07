import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProfileIdentity } from '@/components/score/ProfileIdentity'
import { Panel } from '@/components/score/Panel'
import { ScoreSection } from '@/components/score/ScoreSection'
import { useUserScore } from '@/hooks/useUserScore'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { uploadAvatar } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

import { ROLE } from '@/components/score/ProfileIdentity'

// Matches the backend's multer limits and mime filter.
const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export function Profile() {
  const { user, patchUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const joinedAt = useUserScore(user?.id).data?.user.joinedAt

  const mutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(user!.id, file),
    onSuccess: (updated) => {
      patchUser({ avatarUrl: updated.avatarUrl ?? null })
      setPreview(null)
      toast.success('Picture updated')
    },
    onError: (err) => {
      setPreview(null)
      toast.error(errorMessage(err, 'Could not upload your picture'))
    },
  })

  function handleFile(file: File | undefined) {
    setValidationError(null)
    if (!file) return

    // Validate client-side so the user gets an instant, specific message
    // instead of a round-trip 400.
    if (!ACCEPTED.includes(file.type)) {
      setValidationError('Choose a PNG, JPEG, WebP or GIF image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setValidationError('That image is over the 2 MB limit.')
      return
    }

    setPreview(URL.createObjectURL(file))
    mutation.mutate(file)
  }

  if (!user) return null

  return (
    <>
      <PageHeader title={<span className="font-medium">Profile</span>} />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-6">
        <ProfileIdentity
          name={user.username}
          role={user.role}
          avatarUrl={preview ?? user.avatarUrl}
          joinedAt={joinedAt}
          dimmed={mutation.isPending}
          action={
            <div className="grid justify-items-end gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED.join(',')}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  handleFile(e.target.files?.[0])
                  // Reset so picking the same file twice still fires onChange.
                  e.target.value = ''
                }}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                {user.avatarUrl ? 'Change picture' : 'Upload picture'}
              </Button>
              {validationError ? (
                <p role="alert" className="text-sm text-destructive">
                  {validationError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">PNG, JPEG, WebP or GIF, up to 2 MB.</p>
              )}
            </div>
          }
        />

        <ScoreSection userId={user.id} isSelf />

        <Panel title="Account">
          <dl className="divide-y px-5 text-sm">
            <Row label="Email">{user.email}</Row>
            <Row label="Role">
              <Badge variant="secondary">{ROLE[user.role]}</Badge>
            </Row>
            <Row label="User ID">
              <span className="font-mono text-xs">{user.id}</span>
            </Row>
          </dl>
        </Panel>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{children}</dd>
    </div>
  )
}
