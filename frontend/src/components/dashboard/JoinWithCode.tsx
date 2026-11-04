import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { JOIN_CODE_LENGTH, JoinCodeInput } from '@/components/common/JoinCodeInput'
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
  const ready = code.length === JOIN_CODE_LENGTH

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
          <JoinCodeInput value={code} onChange={setCode} />
          <Button type="submit" variant="secondary" disabled={!ready || join.isPending}>
            {join.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Join room
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
