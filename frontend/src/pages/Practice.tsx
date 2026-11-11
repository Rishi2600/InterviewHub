import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bot, CalendarClock, Hourglass, Loader2, Play, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/States'
import { LiveDot } from '@/components/common/LiveDot'
import { PastInterviews } from '@/components/practice/PastInterviews'
import { ScoreChart } from '@/components/practice/ScoreChart'
import { SentenceSetup } from '@/components/practice/SentenceSetup'
import { DEFAULT_SETUP } from '@/components/practice/setup'
import type { Setup } from '@/components/practice/setup'
import { START_REFUSED, practiceTitle } from '@/components/practice/labels'
import { useAuth } from '@/hooks/useAuth'
import { useNow } from '@/hooks/useNow'
import { errorCode, errorMessage } from '@/lib/api'
import { getPracticeOverview, startPractice } from '@/lib/endpoints'
import type { PracticeOverview } from '@/types'
import { cn } from '@/lib/utils'

/** AI practice: set up an interview in one sentence, then see how it went. */
export function Practice() {
  const { user } = useAuth()
  const isCandidate = user?.role === 'candidate'
  const overview = useQuery({
    queryKey: ['practice'],
    queryFn: getPracticeOverview,
    enabled: isCandidate,
    // While feedback is being written, check back for it.
    refetchInterval: (q) => (q.state.data?.items.some((i) => i.status === 'ended') ? 5_000 : false),
  })

  return (
    <>
      <PageHeader title={<span className="font-medium">AI practice</span>} />
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">AI practice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A practice interview with an AI interviewer, by chat or voice, with written feedback at the end.
          </p>
        </div>
        {!isCandidate ? (
          <EmptyState icon={<Bot />} title="AI practice is for candidates" description="Sign in with a candidate account to practise with the AI interviewer." />
        ) : overview.isLoading ? (
          <Skeleton className="h-80 rounded-2xl" />
        ) : overview.isError || !overview.data ? (
          <ErrorState title="Couldn't load AI practice" message={errorMessage(overview.error)} onRetry={() => void overview.refetch()} />
        ) : (
          <PracticeHome data={overview.data} onRefresh={() => void overview.refetch()} />
        )}
      </div>
    </>
  )
}

function PracticeHome({ data, onRefresh }: { data: PracticeOverview; onRefresh: () => void }) {
  const navigate = useNavigate()
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP)
  const [refused, setRefused] = useState<string | null>(null)
  const start = useMutation({
    mutationFn: () =>
      startPractice({
        kind: setup.kind,
        topic: setup.topic,
        level: setup.level,
        minutes: setup.minutes,
        mode: setup.mode,
        ...(setup.kind === 'technical' && setup.coding && { language: setup.language }),
      }),
    onSuccess: (iv) => navigate(`/practice/${iv.id}`),
    onError: (err) => {
      const code = errorCode(err)
      if (code === 'PracticeRunning') onRefresh()
      else if (code && START_REFUSED[code]) setRefused(code)
      else toast.error(errorMessage(err, "Couldn't start the interview"))
    },
  })

  const { allowance, running } = data
  const used = allowance.used >= allowance.limit
  const blocked = running ? 'running' : !data.enabled ? 'PracticeOff' : used ? 'PracticeMonthUsed' : refused
  return (
    <>
      <section className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-brand">
            <Bot className="size-4" aria-hidden />
            New practice interview
          </span>
          <Allowance used={allowance.used} limit={allowance.limit} />
        </div>
        <SentenceSetup
          setup={setup}
          onChange={(s) => {
            setSetup(s)
            setRefused(null)
          }}
        />
        <div className="mt-6 grid gap-3">
          {running ? (
            <RunningNote id={running.id} title={practiceTitle(running)} endsAt={running.endsAt} />
          ) : blocked && START_REFUSED[blocked] ? (
            <BlockedNote code={blocked} />
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" className="h-11 px-6" onClick={() => start.mutate()} disabled={Boolean(blocked) || start.isPending}>
              {start.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              Start {setup.minutes}-minute interview
            </Button>
            <p className="flex max-w-xl gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
              <span>
                Private to you, and it doesn't change your candidate score. The AI runs on Groq, which doesn't keep your answers. We keep only
                your feedback: the chat is deleted once it's written.
              </span>
            </p>
          </div>
        </div>
      </section>
      <p className="mt-3 px-1 text-xs leading-relaxed text-muted-foreground">
        Voice works in Chrome, Edge and Safari. Chrome sends your speech to Google to turn it into text. You can switch to typing at any time.
      </p>
      <ScoreChart items={data.items} />
      <PastInterviews items={data.items} />
    </>
  )
}

function Allowance({ used, limit }: { used: number; limit: number }) {
  const left = Math.max(0, limit - used)
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
      <span className="flex w-12 gap-1" aria-hidden>
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < used ? 'bg-primary' : 'bg-muted')} />
        ))}
      </span>
      <span className="tnum font-medium">{left ? `${left} of ${limit} left this month` : `All ${limit} used this month`}</span>
    </span>
  )
}

function RunningNote({ id, title, endsAt }: { id: string; title: string; endsAt: string }) {
  const now = useNow(30_000)
  const minutes = Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 60_000))
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-3 text-sm">
      <LiveDot />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title} is still running</div>
        <div className="text-muted-foreground">
          {minutes} {minutes === 1 ? 'minute' : 'minutes'} left. Finish it or end it before starting another.
        </div>
      </div>
      <Button size="sm" asChild>
        <Link to={`/practice/${id}`}>
          <Play aria-hidden />
          Resume
        </Link>
      </Button>
    </div>
  )
}

function BlockedNote({ code }: { code: string }) {
  const { title, detail } = START_REFUSED[code]
  const Icon = code === 'PracticeMonthUsed' ? CalendarClock : Hourglass
  return (
    <div className="flex gap-3 rounded-lg border bg-muted/60 px-3.5 py-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{detail}</div>
      </div>
    </div>
  )
}
