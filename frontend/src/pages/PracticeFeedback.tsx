import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Bot,
  Calendar,
  ChevronRight,
  CircleCheck,
  Code2,
  CloudOff,
  Gauge,
  Grid3x3,
  Lightbulb,
  Lock,
  MessageSquare,
  MessageSquareOff,
  RotateCcw,
  Timer,
  Trash2,
  UsersRound,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/States'
import { InlineText } from '@/components/practice/Conversation'
import { KIND_LABEL, formatScore, practiceTitle } from '@/components/practice/labels'
import { errorMessage, errorStatus } from '@/lib/api'
import { deletePractice, getPractice } from '@/lib/endpoints'
import { formatDay } from '@/lib/score'
import type { PracticeFeedback as Feedback, PracticeInterview } from '@/types'
import { cn } from '@/lib/utils'

/** The written feedback on one practice interview, as a report. */
export function PracticeFeedback() {
  const { id = '' } = useParams<{ id: string }>()
  const query = useQuery({
    queryKey: ['practice', id],
    queryFn: () => getPractice(id),
    enabled: Boolean(id),
    // Still being written: check back.
    refetchInterval: (q) => (q.state.data?.status === 'ended' ? 4_000 : false),
  })
  const iv = query.data

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <Link to="/practice" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              AI practice
            </Link>
            <ChevronRight className="hidden size-3.5 text-muted-foreground sm:inline" aria-hidden />
            <span className="truncate font-medium">{iv ? practiceTitle(iv) : 'Feedback'}</span>
          </span>
        }
      />
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        {query.isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : query.isError || !iv ? (
          errorStatus(query.error) === 404 ? (
            <EmptyState
              icon={<MessageSquareOff />}
              title="This feedback isn't here"
              description="It may have been deleted."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/practice">Back to AI practice</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState title="Couldn't load the feedback" message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
          )
        ) : iv.status === 'active' ? (
          <Navigate to={`/practice/${iv.id}`} replace />
        ) : (
          <>
            <TitleBlock iv={iv} />
            {iv.status === 'done' && iv.feedback ? <Report iv={iv} feedback={iv.feedback} /> : <NotReady iv={iv} />}
          </>
        )}
      </div>
    </>
  )
}

function TitleBlock({ iv }: { iv: PracticeInterview }) {
  const took = iv.endedAt ? Math.max(1, Math.round((new Date(iv.endedAt).getTime() - new Date(iv.startedAt).getTime()) / 60_000)) : null
  const KindIcon = iv.kind === 'technical' ? Code2 : UsersRound
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-brand">
          <KindIcon className="size-3" aria-hidden />
          {KIND_LABEL[iv.kind]}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <Lock className="size-3" aria-hidden />
          Private
        </span>
      </div>
      <h1 className="text-2xl font-semibold sm:text-3xl">
        {practiceTitle(iv)}
        {iv.mixed && <span className="font-normal text-muted-foreground"> (mixed)</span>}
      </h1>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5" aria-hidden />
          {formatDay(iv.startedAt)}, {new Date(iv.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Timer className="size-3.5" aria-hidden />
          {iv.minutes} min, {iv.mode}
        </span>
        {took && (
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-3.5" aria-hidden />
            {took} min · {iv.answers} {iv.answers === 1 ? 'answer' : 'answers'}
          </span>
        )}
      </div>
    </div>
  )
}

/** One bar per area: magnitude in one hue, the value in text beside it. */
function AreaBars({ areas }: { areas: Feedback['areas'] }) {
  return (
    <ul className="grid gap-3">
      {areas.map((a) => (
        <li key={a.name} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_1.5rem] items-center gap-3 text-sm" title={`${a.name}: ${a.score} out of 5`}>
          <span className="truncate">{a.name}</span>
          <span className="relative h-2 rounded-full bg-muted" aria-hidden>
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(a.score / 5) * 100}%` }} />
            {[1, 2, 3, 4].map((t) => (
              <span key={t} className="absolute inset-y-0 w-0.5 bg-card" style={{ left: `${t * 20}%` }} />
            ))}
          </span>
          <span className="tnum text-right font-semibold">{a.score}</span>
        </li>
      ))}
    </ul>
  )
}

const ScoreChip = ({ score }: { score: number }) => (
  <span
    className={cn(
      'tnum inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-semibold',
      score >= 4 ? 'bg-primary text-primary-foreground' : score === 3 ? 'bg-primary/15 text-brand' : 'bg-muted',
    )}
    title={`${score} out of 5`}
  >
    {score}
  </span>
)

function Card({ title, extra, children }: { title: string; extra?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {extra && <span className="ml-auto text-xs text-muted-foreground">{extra}</span>}
      </div>
      {children}
    </section>
  )
}

function Report({ iv, feedback }: { iv: PracticeInterview; feedback: Feedback }) {
  return (
    <>
      <section className="rounded-xl border bg-card">
        <div className="grid gap-6 p-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:p-6">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="tnum font-heading text-5xl font-semibold">{formatScore(iv.score ?? 0)}</span>
              <span className="text-sm text-muted-foreground">out of 5</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">Average of the {feedback.areas.length} areas</div>
          </div>
          <AreaBars areas={feedback.areas} />
        </div>
        <p className="border-t px-5 py-4 text-[15px] leading-relaxed sm:px-6">{feedback.summary}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="What went well">
          <ul className="grid gap-2.5 p-5">
            {feedback.strengths.map((s) => (
              <li key={s} className="flex gap-2.5 text-sm leading-relaxed">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="What to work on">
          <ol className="grid gap-3 p-5">
            {feedback.improve.map((item, i) => (
              <li key={item.point} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="tnum grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold">{i + 1}</span>
                <span>
                  <span className="font-medium">{item.point}</span> <span className="text-muted-foreground">{item.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {feedback.questions.length > 0 && (
        <Card title="Question by question" extra={`${feedback.questions.length} ${feedback.questions.length === 1 ? 'question' : 'questions'}`}>
          <ul className="divide-y px-5">
            {feedback.questions.map((q, i) => (
              <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-4">
                <ScoreChip score={q.score} />
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {q.coding && <Code2 className="size-3.5 text-brand" aria-hidden />}
                    {q.title}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    <InlineText text={q.note} />
                  </p>
                  <p className="mt-2 inline-flex gap-1.5 text-xs">
                    <Lightbulb className="size-3.5 shrink-0 text-brand" aria-hidden />
                    <span>
                      <InlineText text={q.tip} />
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Footer iv={iv} />
    </>
  )
}

function Footer({ iv }: { iv: PracticeInterview }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const remove = useMutation({
    mutationFn: () => deletePractice(iv.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['practice', iv.id] })
      void queryClient.invalidateQueries({ queryKey: ['practice'] })
      toast.success('Feedback deleted')
      navigate('/practice')
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't delete the feedback")),
  })
  const fact = (Icon: typeof Lock, text: string, brand = false) => (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={cn('size-3.5', brand && 'text-brand')} aria-hidden />
      {text}
    </span>
  )
  return (
    <div className="grid gap-4 border-t pt-5 pb-4">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {fact(Lock, 'Only you can see this')}
        {fact(Gauge, 'Not part of your candidate score')}
        {fact(Grid3x3, 'Added to your activity graph', true)}
        {fact(MessageSquareOff, 'The chat itself was deleted')}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link to="/practice">
            <RotateCcw aria-hidden />
            Practise again
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirm(true)} disabled={remove.isPending}>
          <Trash2 aria-hidden />
          Delete feedback
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              It's gone for good. The square on your activity graph stays, and it still counts as one of this month's interviews.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Delete feedback
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Still being written, given up on, or cancelled. */
function NotReady({ iv }: { iv: PracticeInterview }) {
  if (iv.status === 'ended') {
    return (
      <section className="grid gap-6 rounded-xl border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Writing your feedback</h2>
            <p className="text-sm text-muted-foreground">Usually about 20 seconds. If the AI service is busy, it's retried for up to a day; this page updates on its own.</p>
          </div>
        </div>
        <div className="grid gap-3">
          <Skeleton className="h-12 w-40" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-2" />
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-6 sm:p-8">
      <span className="grid size-10 place-items-center rounded-lg bg-muted">
        <CloudOff className="size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-lg font-semibold">{iv.status === 'cancelled' ? 'No feedback for this one' : "The feedback couldn't be written"}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {iv.status === 'cancelled'
            ? 'The interview ended before any answers, so it has no feedback and didn\'t count toward the month.'
            : 'The AI service was busy for a whole day after the interview. The chat has been deleted, as it always is.'}
        </p>
      </div>
      <div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/practice">Back to AI practice</Link>
        </Button>
      </div>
    </section>
  )
}
