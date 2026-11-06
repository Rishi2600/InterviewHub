import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CreateDialog } from '@/components/dashboard/CreateDialog'
import { useCanHost } from '@/hooks/useAuth'
import { createContest } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

/** For hosts: names a new draft, then opens it in the editor. */
export function NewContestButton({ variant = 'default' }: { variant?: 'default' | 'outline' }) {
  const canHost = useCanHost()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const create = useMutation({
    mutationFn: createContest,
    onSuccess: (contest) => {
      void queryClient.invalidateQueries({ queryKey: ['contests'] })
      setOpen(false)
      navigate(`/contests/${contest._id}/edit`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not create the contest')),
  })
  if (!canHost) return null
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Trophy aria-hidden />
        <span className="hidden sm:inline">New contest</span>
      </Button>
      <CreateDialog
        open={open}
        onOpenChange={setOpen}
        title="Create a contest"
        description="It starts as a draft only you can see. Add questions and a start time, then publish."
        label="Contest title"
        placeholder="React Hooks in Practice"
        submitLabel="Create draft"
        pending={create.isPending}
        onSubmit={(title) => create.mutate(title)}
      />
    </>
  )
}
