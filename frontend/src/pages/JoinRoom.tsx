import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, KeyRound } from 'lucide-react'
import { Button } from '@/components/legacy/Button'
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
    <div className="mx-auto flex max-w-md flex-col py-8">
      <div className="animate-rise">
        <p className="label mb-3 flex items-center gap-2">
          <KeyRound className="size-3" aria-hidden />
          Join room
        </p>
        <h1 className="text-heading text-ink">Enter your join code</h1>
        <p className="mt-2 text-caption text-ink-muted">
          The {CODE_LENGTH}-character code your interviewer shared.
        </p>
      </div>

      <div className="mt-8 animate-rise border-t border-line pt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex flex-col gap-5"
        >
          <div>
            <label htmlFor="room-code" className="sr-only">
              Room code
            </label>
            {/* The code is a figure: mono, tabular, and wide-tracked. */}
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
              className="num h-16 w-full rounded-[var(--radius-container)] border border-line bg-surface text-center text-display uppercase tracking-[0.35em] text-ink hover:border-line-strong focus:border-line-strong"
            />
            {error ? (
              <p id="room-code-error" role="alert" className="mt-3 text-micro text-clay">
                {error}
              </p>
            ) : (
              <p id="room-code-hint" className="num mt-3 text-micro text-ink-faint">
                {code.length}/{CODE_LENGTH} characters
              </p>
            )}
          </div>

          {/* The one primary action on this screen. */}
          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={code.length !== CODE_LENGTH}
            isLoading={mutation.isPending}
          >
            Join room
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </form>
      </div>
    </div>
  )
}