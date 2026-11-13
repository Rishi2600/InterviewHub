import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, ChevronDown, CircleCheck, CircleX, Flag, GraduationCap, ListChecks, MessageSquareOff, Pause, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/common/States'
import { InlineText } from '@/components/practice/Conversation'
import { drillTitle } from '@/components/prep/labels'
import { useStartPrep } from '@/hooks/useStartPrep'
import { errorMessage, errorStatus } from '@/lib/api'
import { answerDrill, flagDrillQuestion, getDrill } from '@/lib/endpoints'
import { cn } from '@/lib/utils'
import type { DrillItem, PrepDrill as Drill } from '@/types'

const LETTERS = ['A', 'B', 'C', 'D']
const plain = (text: string) => text.replace(/`/g, '')

/** One drill: questions answered in order, each checked the moment it's answered. */
export function PrepDrill() {
  const { id = '' } = useParams<{ id: string }>()
  const drill = useQuery({ queryKey: ['drill', id], queryFn: () => getDrill(id), enabled: Boolean(id) })
  const d = drill.data

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/prep" aria-label="Back to prep">
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-brand">
          <ListChecks className="size-4" aria-hidden />
        </span>
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="truncate text-sm font-semibold">{d ? drillTitle(d) : 'Drill'}</span>
          {d && (
            <span className="truncate text-xs text-muted-foreground">
              {d.status === 'done' ? 'Finished' : `Question ${Math.min(d.total, d.answered + 1)} of ${d.total} · ${d.right} right so far`}
            </span>
          )}
        </span>
        {d?.status === 'active' && (
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link to="/prep">
              <Pause aria-hidden />
              Finish later
            </Link>
          </Button>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-16 md:p-8">
        {drill.isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : drill.isError || !d ? (
          errorStatus(drill.error) === 404 ? (
            <EmptyState
              icon={<MessageSquareOff />}
              title="This drill isn't here"
              description="It may have been closed with no answers."
              action={
                <Button asChild variant="outline">
                  <Link to="/prep">Back to prep</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState title="Couldn't load the drill" message={errorMessage(drill.error)} onRetry={() => void drill.refetch()} />
          )
        ) : (
          <DrillBody key={d.id} drill={d} />
        )}
      </main>
    </div>
  )
}

function DrillBody({ drill }: { drill: Drill }) {
  const queryClient = useQueryClient()
  // The question on screen: the current one, or an earlier one picked in the rail.
  const [shown, setShown] = useState(Math.min(drill.answered, drill.items.length - 1))
  const [showResults, setShowResults] = useState(drill.status === 'done')
  const setDrill = (next: Drill) => queryClient.setQueryData(['drill', drill.id], next)

  const answer = useMutation({
    mutationFn: ({ item, optionId }: { item: DrillItem; optionId: string }) => answerDrill(drill.id, item.questionId, optionId),
    onSuccess: setDrill,
    onError: (err) => toast.error(errorMessage(err, "Couldn't save your answer")),
  })
  const flag = useMutation({
    mutationFn: (item: DrillItem) => flagDrillQuestion(drill.id, item.questionId),
    onSuccess: (next) => {
      setDrill(next)
      toast.success('Thanks. Questions flagged by two people are taken out.')
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't flag it")),
  })

  const item = drill.items[shown]
  const isLast = shown === drill.total - 1 || (drill.status === 'done' && shown === drill.items.length - 1)
  const next = () => {
    if (drill.status === 'done' && isLast) setShowResults(true)
    else setShown(Math.min(shown + 1, drill.items.length - 1))
  }

  // Keys 1 to 4 answer, Enter moves on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (!item || showResults) return
      const n = Number(e.key)
      if (item.chosen === undefined && n >= 1 && n <= item.options.length && !answer.isPending) {
        answer.mutate({ item, optionId: item.options[n - 1].id })
      } else if (e.key === 'Enter' && item.chosen !== undefined) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (showResults) return <Results drill={drill} onReview={(i) => (setShown(i), setShowResults(false))} />

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <Rail drill={drill} shown={shown} onPick={setShown} />
      <div className="grid gap-4">
        <Progress drill={drill} className="lg:hidden" />
        <section className="grid gap-5 rounded-xl border bg-card p-6">
          <div className="text-xs font-medium text-muted-foreground">Question {shown + 1}</div>
          <h1 className="-mt-3 text-xl leading-snug font-semibold">
            <InlineText text={item.prompt} />
          </h1>
          {item.code && <pre className="overflow-x-auto rounded-lg border bg-muted/60 px-4 py-3 font-mono text-sm">{item.code}</pre>}
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Options">
            {item.options.map((o, i) => (
              <Option
                key={o.id}
                letter={LETTERS[i]}
                text={o.text}
                state={
                  item.chosen === undefined
                    ? 'open'
                    : o.id === item.correctOptionId
                      ? 'right'
                      : o.id === item.chosen
                        ? 'wrong'
                        : 'other'
                }
                disabled={item.chosen !== undefined || answer.isPending}
                onClick={() => answer.mutate({ item, optionId: o.id })}
              />
            ))}
          </div>
          {item.chosen !== undefined && (
            <Explanation item={item} flagging={flag.isPending} onFlag={() => flag.mutate(item)} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {item.chosen === undefined ? (
              <span className="text-xs text-muted-foreground">Pick an answer: it's checked straight away and can't be changed. Keys 1–4 work too.</span>
            ) : (
              <Button className="h-10 px-5" onClick={next}>
                {drill.status === 'done' && isLast ? 'See results' : shown < drill.answered - 1 || drill.status === 'done' ? 'Next' : 'Next question'}
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Option({
  letter,
  text,
  state,
  disabled,
  onClick,
}: {
  letter: string
  text: string
  state: 'open' | 'right' | 'wrong' | 'other'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm disabled:cursor-default',
        state === 'open' && 'bg-card hover:border-primary/60 hover:bg-primary/5',
        state === 'right' && 'border-primary bg-primary/10',
        state === 'wrong' && 'border-danger/60 bg-danger/5',
        state === 'other' && 'bg-card opacity-60',
      )}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-md border bg-background font-mono text-xs">{letter}</span>
      <span className="flex-1">
        <InlineText text={text} />
      </span>
      {state === 'right' && <CircleCheck className="size-4 text-brand" aria-label="Right answer" />}
      {state === 'wrong' && <CircleX className="size-4 text-danger" aria-label="Your answer" />}
    </button>
  )
}

function Explanation({ item, flagging, onFlag }: { item: DrillItem; flagging: boolean; onFlag: () => void }) {
  const right = item.correct
  const letter = LETTERS[item.options.findIndex((o) => o.id === item.correctOptionId)]
  return (
    <div className={cn('grid gap-2 rounded-lg border px-4 py-3', right ? 'border-primary/40 bg-primary/[0.06]' : 'border-danger/30 bg-danger/[0.04]')}>
      <div className={cn('flex items-center gap-2 text-sm font-semibold', right ? 'text-brand' : 'text-danger')}>
        {right ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
        {right ? 'Right' : `Not quite: it's ${letter}`}
      </div>
      <p className="text-sm">
        <InlineText text={item.explanation ?? ''} />
      </p>
      {item.flagged ? (
        <span className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
          <Flag className="size-3.5" aria-hidden />
          Flagged as wrong. Thanks.
        </span>
      ) : (
        <button type="button" disabled={flagging} onClick={onFlag} className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Flag className="size-3.5" aria-hidden />
          This answer looks wrong
        </button>
      )}
    </div>
  )
}

function Progress({ drill, className }: { drill: Drill; className?: string }) {
  return (
    <div className={cn('flex gap-1', className)} aria-hidden>
      {Array.from({ length: drill.total }, (_, i) => {
        const it = drill.items[i]
        return (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              it?.chosen === undefined ? (i === drill.answered ? 'bg-foreground/40' : 'bg-muted') : it.correct ? 'bg-primary' : 'bg-danger',
            )}
          />
        )
      })}
    </div>
  )
}

/** Every question: answered ones by title, the rest by number. */
function Rail({ drill, shown, onPick }: { drill: Drill; shown: number; onPick: (i: number) => void }) {
  return (
    <aside className="hidden rounded-xl border bg-card lg:sticky lg:top-20 lg:block">
      <div className="grid gap-0.5 p-2">
        {Array.from({ length: drill.total }, (_, i) => {
          const it = drill.items[i]
          const answered = it?.chosen !== undefined
          const reachable = i < drill.items.length
          return (
            <button
              key={i}
              type="button"
              disabled={!reachable}
              onClick={() => onPick(i)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                i === shown ? 'bg-muted font-medium' : reachable ? 'hover:bg-muted/60' : 'text-muted-foreground',
              )}
            >
              {answered ? (
                it.correct ? (
                  <CircleCheck className="size-4 shrink-0 text-brand" aria-label="Right" />
                ) : (
                  <CircleX className="size-4 shrink-0 text-danger" aria-label="Missed" />
                )
              ) : (
                <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border text-[9px]', i === shown && 'border-foreground')}>{i + 1}</span>
              )}
              <span className="truncate">{reachable ? plain(it.prompt) : `Question ${i + 1}`}</span>
            </button>
          )
        })}
      </div>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{drill.right} right</span> of {drill.answered} answered
      </div>
    </aside>
  )
}

function Results({ drill, onReview }: { drill: Drill; onReview: (i: number) => void }) {
  const navigate = useNavigate()
  const { start, pending } = useStartPrep()
  const missed = drill.items.filter((i) => i.correct === false)
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="grid gap-5 rounded-2xl border border-primary/30 bg-primary/[0.06] p-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="font-heading text-6xl font-semibold tabular-nums">
          {drill.right}
          <span className="text-3xl text-muted-foreground">/{drill.answered}</span>
        </div>
        <div className="grid gap-3">
          <div>
            <h1 className="text-xl font-semibold">{drillTitle(drill)} done</h1>
            <p className="text-sm text-muted-foreground">
              {missed.length === 0
                ? 'Every one right. Try the next level up?'
                : `You missed ${missed.length} of ${drill.answered}. A coach session can go through them with you.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {missed.length > 0 && (
              <Button disabled={!!pending} onClick={() => start({ mode: 'coach', topic: drill.topic, level: drill.level })}>
                <GraduationCap aria-hidden />
                Coach me on {drill.topic}
              </Button>
            )}
            <Button variant="outline" disabled={!!pending} onClick={() => start({ mode: 'drill', topic: drill.topic, level: drill.level })}>
              <RotateCcw aria-hidden />
              Another {drill.topic} drill
            </Button>
            <Button variant="ghost" onClick={() => navigate('/prep')}>
              <ArrowLeft aria-hidden />
              Back to prep
            </Button>
          </div>
        </div>
      </section>
      <section className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-5 py-3.5">
          <h2 className="text-base font-semibold">Your answers</h2>
          <span className="ml-auto text-xs text-muted-foreground">Open one for its explanation</span>
        </div>
        {drill.items.map((it, i) => (
          <details key={it.questionId} className="group border-t first:border-t-0">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 text-sm hover:bg-muted/50">
              <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
              {it.correct ? <CircleCheck className="size-4 shrink-0 text-brand" aria-label="Right" /> : <CircleX className="size-4 shrink-0 text-danger" aria-label="Missed" />}
              <span className="min-w-0 flex-1 truncate">{plain(it.prompt)}</span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-2 px-5 pb-4 pl-[3.75rem] text-sm text-muted-foreground">
              <InlineText text={it.explanation ?? ''} />
              <button type="button" className="w-fit text-xs text-brand hover:underline" onClick={() => onReview(i)}>
                See the question
              </button>
            </div>
          </details>
        ))}
      </section>
    </div>
  )
}
