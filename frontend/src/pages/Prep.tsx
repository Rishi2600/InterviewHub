import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarClock, GraduationCap, Hourglass, ListChecks, Loader2, Play, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/States'
import { LiveDot } from '@/components/common/LiveDot'
import { practiceTitle } from '@/components/practice/labels'
import { PREP_REFUSED, drillTitle } from '@/components/prep/labels'
import { PrepSentence } from '@/components/prep/PrepSentence'
import { DEFAULT_CHOICE } from '@/components/prep/choice'
import type { PrepChoice } from '@/components/prep/choice'
import { PrepSessions } from '@/components/prep/PrepSessions'
import { Recommended } from '@/components/prep/Recommended'
import { useAuth } from '@/hooks/useAuth'
import { useNow } from '@/hooks/useNow'
import { useStartPrep } from '@/hooks/useStartPrep'
import { errorMessage } from '@/lib/api'
import { getPrepOverview, setPrepFocus } from '@/lib/endpoints'
import type { PrepOverview } from '@/types'

/** Prep: prepare for anything, with a tailored section below. */
export function Prep() {
  const { user } = useAuth()
  const isCandidate = user?.role === 'candidate'
  const overview = useQuery({
    queryKey: ['prep'],
    queryFn: getPrepOverview,
    enabled: isCandidate,
    // A coach recap still being written: check back for it.
    refetchInterval: (q) => (q.state.data?.items.some((i) => i.mode === 'coach' && i.status === 'ended') ? 5_000 : false),
  })

  return (
    <>
      <PageHeader title={<span className="font-medium">Prep</span>} />
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Prep</h1>
          <p className="mt-1 text-sm text-muted-foreground">Learn, not just test: quick drills checked as you go, and an AI coach that teaches by asking.</p>
        </div>
        {!isCandidate ? (
          <EmptyState icon={<GraduationCap />} title="Prep is for candidates" description="Sign in with a candidate account to prepare with drills and the AI coach." />
        ) : overview.isLoading ? (
          <Skeleton className="h-80 rounded-2xl" />
        ) : overview.isError || !overview.data ? (
          <ErrorState title="Couldn't load prep" message={errorMessage(overview.error)} onRetry={() => void overview.refetch()} />
        ) : (
          <PrepHome data={overview.data} />
        )}
      </div>
    </>
  )
}

function PrepHome({ data }: { data: PrepOverview }) {
  const queryClient = useQueryClient()
  const [choice, setChoice] = useState<PrepChoice>(DEFAULT_CHOICE)
  const { start, pending, refused, clearRefused } = useStartPrep()
  const focus = useMutation({
    mutationFn: setPrepFocus,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['prep'] }),
    onError: (err) => toast.error(errorMessage(err, "Couldn't save your focus")),
  })

  const coach = choice.mode === 'coach'
  const { today, running } = data
  const left = { drill: today.drill.limit - today.drill.used, coach: today.coach.limit - today.coach.used }
  // What stops this start, if anything.
  const blocked = coach
    ? !data.aiEnabled
      ? 'PrepCoachOff'
      : left.coach <= 0
        ? 'PrepDayUsed'
        : refused
    : left.drill <= 0
      ? 'PrepDayUsed'
      : refused
  const startChoice = () =>
    start({
      mode: choice.mode,
      topic: choice.topic,
      level: choice.level,
      ...(choice.own && { kind: choice.ownKind }),
    })

  return (
    <>
      <section className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-brand">
            <GraduationCap className="size-4" aria-hidden />
            Prepare for anything
          </span>
          <span className="inline-flex items-center gap-3 rounded-lg border bg-card px-3 py-1.5 text-xs tabular-nums">
            <span className="inline-flex items-center gap-1">
              <GraduationCap className="size-3.5" aria-hidden />
              {Math.max(0, left.coach)}/{today.coach.limit} coach
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3.5" aria-hidden />
              {Math.max(0, left.drill)}/{today.drill.limit} drills
            </span>
            <span className="text-muted-foreground">left today</span>
          </span>
        </div>
        <PrepSentence
          choice={choice}
          onChange={(c) => {
            setChoice(c)
            clearRefused()
          }}
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {coach
            ? "A tutor that asks, hints when you're stuck and explains. Up to 20 minutes or 20 answers, then a recap."
            : '10 questions, each checked the moment you answer, with the reason.'}
        </p>
        <div className="mt-6 grid gap-3">
          {running.coach && coach && <RunningCoach session={running.coach} />}
          {running.drill && !coach && (
            <ResumeNote
              title={`${drillTitle(running.drill)} is in progress`}
              detail={`${running.drill.answered} of ${running.drill.total} answered. Starting another drill finishes it.`}
              to={`/prep/drills/${running.drill.id}`}
            />
          )}
          {blocked && PREP_REFUSED[blocked] && <BlockedNote code={blocked} />}
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" className="h-11 px-6" onClick={startChoice} disabled={Boolean(blocked) || (coach && !!running.coach) || !!pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              {coach ? 'Start coaching' : 'Start drill'}
            </Button>
            <p className="flex max-w-xl gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
              <span>
                {pending?.mode === 'drill'
                  ? "If you've seen every saved question here, the AI writes 10 more first: about 10 seconds."
                  : "Private to you, and it doesn't change your candidate score. The AI runs on Groq, which doesn't keep your answers."}
              </span>
            </p>
          </div>
        </div>
      </section>

      <Recommended
        data={data.recommended}
        focus={data.focus}
        busy={pending ?? null}
        onStart={start}
        onFocusChange={(topics) => focus.mutate(topics)}
      />
      <PrepSessions items={data.items} nextBefore={data.nextBefore} />
    </>
  )
}

function RunningCoach({ session }: { session: NonNullable<PrepOverview['running']['coach']> }) {
  const now = useNow(30_000)
  const minutes = Math.max(0, Math.ceil((new Date(session.endsAt).getTime() - now) / 60_000))
  return (
    <ResumeNote
      title={`Coach · ${practiceTitle(session)} is still running`}
      detail={`${minutes} ${minutes === 1 ? 'minute' : 'minutes'} left. Finish it or end it before starting another.`}
      to={`/practice/${session.id}`}
    />
  )
}

function ResumeNote({ title, detail, to }: { title: string; detail: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-3 text-sm">
      <LiveDot />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{detail}</div>
      </div>
      <Button size="sm" asChild>
        <Link to={to}>
          <Play aria-hidden />
          Resume
        </Link>
      </Button>
    </div>
  )
}

function BlockedNote({ code }: { code: string }) {
  const { title, detail } = PREP_REFUSED[code]
  const Icon = code === 'PrepDayUsed' ? CalendarClock : Hourglass
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
