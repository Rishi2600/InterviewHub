import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { languageFor } from '@/components/practice/labels'
import { CODING_TOPICS, PREP_REFUSED } from '@/components/prep/labels'
import { errorCode, errorMessage } from '@/lib/api'
import { startCoach, startDrill } from '@/lib/endpoints'
import type { PracticeKind, PracticeLevel, PrepMode } from '@/types'

export interface PrepStart {
  mode: PrepMode
  topic: string
  level: PracticeLevel
  /** For a coach session: the area to focus on. */
  focus?: string | null
  /** For the candidate's own coach topic: its type. */
  kind?: PracticeKind
}

/**
 * Starts a drill or a coach session and opens it. A refusal the page should
 * explain (the day's limit, the AI being full) comes back as `refused`.
 */
export function useStartPrep() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [refused, setRefused] = useState<string | null>(null)
  const start = useMutation({
    mutationFn: async (s: PrepStart) => {
      if (s.mode === 'drill') return { path: `/prep/drills/${(await startDrill(s.topic, s.level)).id}` }
      const session = await startCoach({
        topic: s.topic,
        level: s.level,
        ...(s.kind && { kind: s.kind }),
        ...(s.focus && { focus: s.focus }),
        ...(CODING_TOPICS.includes(s.topic) && { language: languageFor(s.topic) }),
      })
      return { path: `/practice/${session.id}` }
    },
    onMutate: () => setRefused(null),
    onSuccess: ({ path }) => {
      void queryClient.invalidateQueries({ queryKey: ['prep'] })
      navigate(path)
    },
    onError: (err) => {
      const code = errorCode(err)
      if (code === 'PrepRunning') {
        void queryClient.invalidateQueries({ queryKey: ['prep'] })
        toast.error('Finish or end your running coach session first')
      } else if (code && PREP_REFUSED[code]) setRefused(code)
      else toast.error(errorMessage(err, "Couldn't start the session"))
    },
  })
  return { start: start.mutate, pending: start.isPending ? start.variables : null, refused, clearRefused: () => setRefused(null) }
}
