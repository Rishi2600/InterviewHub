import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { joinRoomByCode } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

const CODE_LENGTH = 5
// Matches the backend's unambiguous alphabet (no I, O, 0, 1).
const ALLOWED = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/

export function JoinRoom() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (value: string) => joinRoomByCode(value),
    onSuccess: (room) => {
      toast.success(`Joined “${room.title}”`)
      navigate(`/rooms/${room._id}`)
    },
    onError: (err) => setError(errorMessage(err, 'Could not join that room')),
  })

  function submit() {
    setError(null)
    if (code.length !== CODE_LENGTH) {
      setError(`Room codes are ${CODE_LENGTH} characters long`)
      return
    }
    mutation.mutate(code)
  }

  function handleChange(value: string) {
    const cleaned = value
      .toUpperCase()
      .split('')
      .filter((c) => ALLOWED.test(c))
      .join('')
      .slice(0, CODE_LENGTH)
    setCode(cleaned)
    setError(null)
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-8">
      <div className="animate-rise text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 grid size-11 place-items-center rounded-[var(--radius-card)] bg-accent-soft text-accent"
        >
          <KeyRound className="size-5" />
        </span>
        <h1 className="text-display font-semibold text-ink">Join a room</h1>
        <p className="mt-1.5 text-body text-ink-muted">
          Enter the {CODE_LENGTH}-character code your interviewer shared.
        </p>
      </div>

      <Card className="animate-rise">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="room-code" className="sr-only">
              Room code
            </label>
            <input
              id="room-code"
              value={code}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              placeholder="AB3D9"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'room-code-error' : 'room-code-hint'}
              onChange={(e) => handleChange(e.target.value)}
              className="h-16 w-full rounded-[var(--radius-card)] border border-line bg-ground text-center font-mono text-display uppercase tracking-[0.35em] text-ink placeholder:text-ink-faint/40 hover:border-line-strong"
            />
            {error ? (
              <p id="room-code-error" role="alert" className="mt-2 text-center text-caption text-danger">
                {error}
              </p>
            ) : (
              <p id="room-code-hint" className="mt-2 text-center text-caption text-ink-faint">
                {code.length}/{CODE_LENGTH} characters
              </p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={code.length !== CODE_LENGTH}
            isLoading={mutation.isPending}
          >
            Join room
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </form>
      </Card>
    </div>
  )
}