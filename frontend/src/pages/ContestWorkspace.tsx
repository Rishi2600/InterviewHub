import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlarmClock, ArrowLeft, ArrowRight, Check, CircleCheck, CloudAlert, CloudCheck, EyeOff, Loader2, Lock, Send, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { Panel, PromptText, Stat } from '@/components/contest/bits'
import { WorkspaceTopBar as TopBar } from '@/components/contest/WorkspaceTopBar'
import { useNow } from '@/hooks/useNow'
import { saveAnswer, startContest, submitContest } from '@/lib/endpoints'
import { errorMessage, errorStatus } from '@/lib/api'
import { clock, countdown } from '@/lib/contest-time'
import { cn } from '@/lib/utils'
import type { QuizQuestionView, Workspace } from '@/types'
import { CodeWorkspace } from './CodeWorkspace'

type QuizWorkspace = Omit<Workspace, 'questions'> & { questions: QuizQuestionView[] }

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: number } | { kind: 'failed'; questionId: string }

const LETTERS = 'ABCDEF'

/** The entrant's focus screen: one question at a time, answers saved as
 *  they are picked, and a timer that ends for everyone at the same moment. */
export function ContestWorkspace() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const workspace = useQuery({
    queryKey: ['contest', id, 'workspace'],
    queryFn: () => startContest(id),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Not live, or not joined: the details page explains and offers the way in.
  useEffect(() => {
    if (!workspace.isError) return
    toast.error(errorMessage(workspace.error))
    navigate(`/contests/${id}`, { replace: true })
  }, [workspace.isError, workspace.error, navigate, id])

  if (workspace.isPending || workspace.isError) return <FullPageLoader label="Opening the workspace…" />
  const ws = workspace.data
  if (ws.contest.format === 'code') return <CodeWorkspace ws={ws} />
  return <Screen ws={{ ...ws, questions: ws.questions as QuizQuestionView[] }} />
}

function Screen({ ws }: { ws: QuizWorkspace }) {
  const contestId = ws.contest._id
  const queryClient = useQueryClient()
  // The device clock may be off; count down on the server's.
  const [offset] = useState(() => new Date(ws.serverNow).getTime() - Date.now())
  const now = useNow(500, offset)
  const start = new Date(ws.contest.startAt).getTime()
  const end = new Date(ws.contest.endAt).getTime()
  const total = ws.questions.length

  const [answers, setAnswers] = useState<Record<string, string[]>>(ws.answers)
  const [index, setIndex] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [confirming, setConfirming] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<string | null>(ws.entry.submittedAt)
  // One chain of saves per question, so quick clicks reach the server in order.
  const chains = useRef(new Map<string, Promise<unknown>>())

  const timeUp = now >= end
  const done = Boolean(submittedAt) || timeUp
  const answered = ws.questions.filter((q) => (answers[q._id]?.length ?? 0) > 0).length
  const unanswered = ws.questions.flatMap((q, i) => ((answers[q._id]?.length ?? 0) > 0 ? [] : [i + 1]))

  const save = useCallback(
    (questionId: string, optionIds: string[]) => {
      setSaveState({ kind: 'saving' })
      const previous = chains.current.get(questionId) ?? Promise.resolve()
      const next = previous
        .catch(() => undefined)
        .then(() => saveAnswer(contestId, questionId, optionIds))
        .then(() => setSaveState({ kind: 'saved', at: Date.now() }))
        .catch((err: unknown) => {
          // Locked: submitted elsewhere or out of time. The screen catches up.
          if (errorStatus(err) === 409) return
          setSaveState({ kind: 'failed', questionId })
        })
      chains.current.set(questionId, next)
    },
    [contestId],
  )

  const pick = (questionId: string, optionId: string, multiple: boolean) => {
    if (done) return
    const current = answers[questionId] ?? []
    const nextPick = multiple
      ? current.includes(optionId)
        ? current.filter((o) => o !== optionId)
        : [...current, optionId]
      : [optionId]
    setAnswers((a) => ({ ...a, [questionId]: nextPick }))
    save(questionId, nextPick)
  }

  const submit = useMutation({
    mutationFn: async () => {
      // Let pending saves land first.
      await Promise.allSettled([...chains.current.values()])
      return submitContest(contestId)
    },
    onSuccess: (res) => {
      setSubmittedAt(res.submittedAt)
      setConfirming(false)
      void queryClient.invalidateQueries({ queryKey: ['contest', contestId] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not submit')),
  })

  // Keyboard: arrows move between questions, A–F pick an option.
  const q = ws.questions[index]
  useEffect(() => {
    if (done) return
    const onKey = (e: KeyboardEvent) => {
      if (confirming || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(total - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else {
        const n = LETTERS.indexOf(e.key.toUpperCase())
        if (n >= 0 && q?.options[n]) pick(q._id, q.options[n].id, q.kind === 'multiple')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const elapsedPct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))

  if (done) {
    const auto = !submittedAt
    const from = Math.max(start, new Date(ws.entry.joinedAt).getTime())
    const used = (submittedAt ? new Date(submittedAt).getTime() : end) - from
    return (
      <div className="min-h-svh bg-background">
        <TopBar title={ws.contest.title} endAt={ws.contest.endAt} contestId={contestId} pct={auto ? 100 : elapsedPct}>
          <span className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
            <Lock className="size-3.5" aria-hidden />
            {auto ? 'Ended' : 'Submitted'}
          </span>
        </TopBar>
        <main className="mx-auto grid max-w-xl gap-6 px-4 py-16">
          <div className="grid justify-items-center gap-4 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-primary/15 text-brand">
              {auto ? <AlarmClock className="size-7" aria-hidden /> : <CircleCheck className="size-7" aria-hidden />}
            </span>
            <h1 className="text-3xl font-semibold">{auto ? "Time's up" : 'Answers submitted'}</h1>
            <p className="text-muted-foreground">
              {auto ? (
                <>
                  Your <span className="font-medium text-foreground">{answered} saved answers</span> go in automatically at{' '}
                  {clock(ws.contest.endAt)}.
                </>
              ) : (
                <>
                  You submitted{' '}
                  <span className="font-medium text-foreground">
                    {answered} of {total}
                  </span>{' '}
                  answers at {clock(submittedAt!)}, after {Math.max(1, Math.round(used / 60_000))} minutes.
                </>
              )}
            </p>
          </div>
          <Panel>
            <dl className="grid grid-cols-3 divide-x text-center">
              <Stat label="Answered" value={`${answered}/${total}`} className="py-4" />
              <Stat label="Time used" value={countdown(used)} className="py-4" />
              <Stat label="Results" value={auto ? '~1 min' : clock(new Date(end + 60_000))} className="py-4" />
            </dl>
            <div className="flex items-center gap-2 border-t px-5 py-3 text-sm text-muted-foreground">
              <EyeOff className="size-4 shrink-0" aria-hidden />
              {auto
                ? 'Scores, correct answers and explanations open in about a minute.'
                : `Scores, correct answers and explanations open when the contest ends at ${clock(ws.contest.endAt)}.`}
            </div>
          </Panel>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button className="w-full" asChild>
              <Link to={`/contests/${contestId}`}>Back to contest page</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/contests">Browse contests</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const picked = new Set(answers[q._id] ?? [])
  const multiple = q.kind === 'multiple'

  return (
    <div className="min-h-svh bg-background">
      <TopBar title={ws.contest.title} endAt={ws.contest.endAt} contestId={contestId} pct={elapsedPct}>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5" role="timer" aria-label="Time left">
            <Timer className="size-4 text-brand" aria-hidden />
            <span className="font-heading text-lg leading-none font-semibold text-brand tabular-nums">{countdown(end - now)}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">left</span>
          </div>
          <Button size="sm" onClick={() => setConfirming(true)}>
            <Send aria-hidden />
            Submit
          </Button>
        </div>
      </TopBar>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 pb-24 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-10">
        <aside className="grid content-start gap-4 lg:sticky lg:top-24">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Questions</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {answered} of {total} answered
            </span>
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto p-1 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:p-0">
            {ws.questions.map((question, i) => {
              const isDone = (answers[question._id]?.length ?? 0) > 0
              return (
                <button
                  key={question._id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Question ${i + 1}${isDone ? ', answered' : ''}`}
                  aria-current={i === index ? 'step' : undefined}
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-md text-sm font-medium tabular-nums',
                    i === index && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    isDone ? 'bg-primary/15 text-brand' : 'border bg-card text-muted-foreground',
                  )}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div className="hidden gap-3 text-xs text-muted-foreground lg:flex">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-primary/15" />
              Answered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded border bg-card" />
              Not yet
            </span>
          </div>
        </aside>

        <article className="mx-auto grid w-full max-w-3xl content-start gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-heading text-lg font-semibold tabular-nums">
              Question {index + 1} <span className="text-muted-foreground">of {total}</span>
            </span>
            <span className="ml-auto inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
              {multiple ? 'Multiple choice' : 'Single choice'}
            </span>
            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
              {q.points} pt{q.points > 1 ? 's' : ''}
            </span>
          </div>
          <PromptText text={q.prompt} className="text-xl leading-snug font-medium" />
          <p className="text-sm text-muted-foreground">
            {multiple
              ? 'Select all that apply. Scores only if every correct option and no wrong one is picked.'
              : 'Pick one.'}
          </p>
          <ul className="grid gap-2" role={multiple ? 'group' : 'radiogroup'}>
            {q.options.map((o, i) => {
              const on = picked.has(o.id)
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role={multiple ? 'checkbox' : 'radio'}
                    aria-checked={on}
                    onClick={() => pick(q._id, o.id, multiple)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-4 text-left text-sm transition-colors',
                      on ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/60',
                    )}
                  >
                    {multiple ? (
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded border',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                        )}
                      >
                        {on && <Check className="size-3.5" aria-hidden />}
                      </span>
                    ) : (
                      <span className="grid size-5 shrink-0 place-items-center rounded-full border bg-card">
                        {on && <span className="size-2.5 rounded-full bg-primary" />}
                      </span>
                    )}
                    <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{LETTERS[i]}</span>
                    <span className="flex-1 whitespace-pre-line">{o.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
              <ArrowLeft aria-hidden />
              Previous
            </Button>
            <SaveStatus state={saveState} onRetry={(qid) => save(qid, answers[qid] ?? [])} />
            {index < total - 1 ? (
              <Button size="sm" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
                Next
                <ArrowRight aria-hidden />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setConfirming(true)}>
                Finish
                <Send aria-hidden />
              </Button>
            )}
          </div>
        </article>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit your answers?</DialogTitle>
            <DialogDescription>
              You&apos;ve answered{' '}
              <span className="font-medium text-foreground">
                {answered} of {total}
              </span>
              . You can&apos;t change anything after submitting.
            </DialogDescription>
          </DialogHeader>
          {unanswered.length > 0 && (
            <div className="grid gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
              <span className="font-medium">{unanswered.length} unanswered</span>
              <span className="flex flex-wrap gap-1.5">
                {unanswered.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="grid h-7 min-w-7 place-items-center rounded-md border bg-card px-2 text-xs font-medium tabular-nums"
                    onClick={() => {
                      setIndex(n - 1)
                      setConfirming(false)
                    }}
                  >
                    {n}
                  </button>
                ))}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {Math.max(0, Math.floor((end - now) / 60_000))} minutes are left. If you don&apos;t submit, your saved answers go in
            automatically at {clock(ws.contest.endAt)}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep answering
            </Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              Submit answers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: (questionId: string) => void }) {
  const text = useMemo(() => {
    if (state.kind === 'saving') return 'Saving…'
    if (state.kind === 'saved') return `Saved ${clock(new Date(state.at))}`
    return ''
  }, [state])
  if (state.kind === 'failed') {
    return (
      <button type="button" className="flex items-center gap-1.5 text-xs text-danger" onClick={() => onRetry(state.questionId)}>
        <CloudAlert className="size-3.5" aria-hidden />
        Not saved. Retry
      </button>
    )
  }
  if (state.kind === 'idle') return <span />
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      {state.kind === 'saving' ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <CloudCheck className="size-3.5 text-brand" aria-hidden />
      )}
      {text}
    </span>
  )
}
