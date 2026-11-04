import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { JOIN_CODE_LENGTH, JoinCodeInput } from '@/components/common/JoinCodeInput'
import { PageHeader } from '@/components/layout/PageHeader'
import { joinRoomByCode } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

export function JoinRoom() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const join = useMutation({
    mutationFn: joinRoomByCode,
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success(`Joined ${room.title}`)
      navigate(`/rooms/${room._id}`)
    },
    onError: (err) => setError(errorMessage(err, 'Could not join that room')),
  })
  const ready = code.length === JOIN_CODE_LENGTH

  return (
    <>
      <PageHeader title={<span>Join a room</span>} />
      <Card className="mx-auto mt-8 w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-xl">Enter your join code</CardTitle>
          <CardDescription>The {JOIN_CODE_LENGTH}-character code your interviewer shared.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid justify-items-center gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (ready) join.mutate(code)
            }}
          >
            <JoinCodeInput
              value={code}
              size="lg"
              autoFocus
              invalid={Boolean(error)}
              onChange={(next) => {
                setCode(next)
                setError(null)
              }}
            />
            <p role={error ? 'alert' : undefined} className={error ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
              {error ?? `${code.length} of ${JOIN_CODE_LENGTH} characters`}
            </p>
            <Button type="submit" className="w-full" disabled={!ready || join.isPending}>
              {join.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Join room
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
