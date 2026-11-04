import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { joinRoomByCode } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

/** Five boxes for a room's join code; joining opens the room. */
export function JoinWithCode() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const join = useMutation({
    mutationFn: joinRoomByCode,
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
      navigate(`/rooms/${room._id}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not join that room')),
  })
  const ready = code.length === 5

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Join with a code</CardTitle>
        <CardDescription>Codes are 5 letters and numbers, shared by the room's host.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (ready) join.mutate(code)
          }}
        >
          <InputOTP
            maxLength={5}
            pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
            aria-label="Join code"
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-11 font-mono text-base" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button type="submit" variant="secondary" disabled={!ready || join.isPending}>
            {join.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Join room
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
