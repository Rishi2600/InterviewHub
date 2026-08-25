import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Section, SectionHeader } from '@/components/ui/Section'
import { RoleBadge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import { uploadAvatar } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

// Matches the backend's multer limits and mime filter.
const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export function Profile() {
  const { user, patchUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(user!.id, file),
    onSuccess: (updated) => {
      patchUser({ avatarUrl: updated.avatarUrl ?? null })
      setPreview(null)
      toast.success('Avatar updated')
    },
    onError: (err) => {
      setPreview(null)
      toast.error(errorMessage(err, 'Could not upload your avatar'))
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
    <div className="mx-auto max-w-2xl animate-rise">
      <header className="pb-8">
        <p className="label mb-3">Baseline</p>
        <h1 className="text-display text-ink">Profile</h1>
      </header>

      <Section>
        <SectionHeader
          label="Avatar"
          title="Your picture"
          description="PNG, JPEG, WebP or GIF, up to 2 MB."
        />

        <div className="flex flex-wrap items-center gap-6">
          <Avatar
            name={user.username}
            id={user.id}
            src={preview ?? user.avatarUrl}
            size="lg"
            className={mutation.isPending ? 'opacity-60' : undefined}
          />

          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="sr-only"
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                // Reset so picking the same file twice still fires onChange.
                e.target.value = ''
              }}
            />
            {/* The one primary action on this screen. */}
            <Button
              onClick={() => fileInputRef.current?.click()}
              isLoading={mutation.isPending}
              leadingIcon={<Upload className="size-3.5" />}
            >
              {user.avatarUrl ? 'Replace image' : 'Upload image'}
            </Button>
            {validationError && (
              <p role="alert" className="text-micro text-clay">
                {validationError}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader
          label="Account"
          title="Your details"
          description="These come from your registration."
        />
        <dl>
          <Field label="Username" value={user.username} />
          <Field label="Email" value={user.email} />
          <div className="flex items-center justify-between gap-4 border-t border-line py-3.5">
            <dt className="label">Role</dt>
            <dd>
              <RoleBadge role={user.role} />
            </dd>
          </div>
          <Field label="User ID" value={user.id} mono />
        </dl>
      </Section>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3.5 first:border-t-0">
      <dt className="label">{label}</dt>
      <dd className={`truncate text-caption text-ink ${mono ? 'num' : ''}`}>{value}</dd>
    </div>
  )
}
