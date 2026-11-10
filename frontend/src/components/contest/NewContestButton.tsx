import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CodeXml, ListChecks, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CreateDialog } from '@/components/dashboard/CreateDialog'
import { useCanHost } from '@/hooks/useAuth'
import { createContest } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ContestFormat } from '@/types'

const FORMATS: { value: ContestFormat; label: string; hint: string; icon: typeof Trophy }[] = [
  { value: 'quiz', label: 'Quiz', hint: 'Single and multiple choice', icon: ListChecks },
  { value: 'code', label: 'Code', hint: 'Programs judged on hidden tests', icon: CodeXml },
]

/** For hosts: names a new draft, then opens it in the editor. */
export function NewContestButton({ variant = 'default' }: { variant?: 'default' | 'outline' }) {
  const canHost = useCanHost()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ContestFormat>('quiz')
  const create = useMutation({
    mutationFn: (title: string) => createContest(title, format),
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
      >
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Format</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {FORMATS.map(({ value, label, hint, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={format === value}
                onClick={() => setFormat(value)}
                className={cn(
                  'grid gap-1 rounded-lg border p-3 text-left text-sm',
                  format === value ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Icon className="size-4 text-brand" aria-hidden />
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">You can't change the format later.</p>
        </fieldset>
      </CreateDialog>
    </>
  )
}
