import type { ReactNode } from 'react'
import { BarChart3, ChevronDown, CircleHelp, CirclePlay, Compass, GraduationCap, Info, ListChecks, Pin, Plus, Target, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LEVEL_LABEL, TOPICS } from '@/components/practice/labels'
import type { PrepStart } from '@/hooks/useStartPrep'
import { formatDay } from '@/lib/score'
import { cn } from '@/lib/utils'
import type { PrepOverview, PrepTopic } from '@/types'
import { percent } from './labels'

const MAX_FOCUS = 3

/** A topic's strength as a bar, or "Not enough yet". */
export function StrengthBar({ strength, className }: { strength: number | null; className?: string }) {
  if (strength === null) return <span className="text-xs text-muted-foreground">Not enough yet</span>
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('relative h-1.5 w-20 overflow-hidden rounded-full bg-muted', className)} aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: percent(strength) }} />
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">{percent(strength)}</span>
    </span>
  )
}

function SubHead({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 border-t bg-muted/40 px-5 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase first:border-t-0 [&_svg]:size-3.5 [&_svg]:self-center">
      {icon}
      {title}
      {hint && <span className="ml-auto tracking-normal normal-case">{hint}</span>}
    </div>
  )
}

/** Drill, Coach and (later) Lesson for one topic. */
function Actions({
  t,
  busy,
  onStart,
}: {
  t: PrepTopic
  busy: PrepStart | null
  onStart: (s: PrepStart) => void
}) {
  const technical = t.kind === 'technical'
  const pending = (mode: string) => busy?.topic === t.topic && busy.mode === mode
  return (
    <span className="flex flex-wrap gap-2">
      {technical && (
        <Button size="sm" disabled={!!busy} onClick={() => onStart({ mode: 'drill', topic: t.topic, level: t.level })}>
          <ListChecks aria-hidden />
          {pending('drill') ? 'Starting…' : 'Drill'}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={!!busy}
        onClick={() => onStart({ mode: 'coach', topic: t.topic, level: t.level, focus: t.focus, technical })}
      >
        <GraduationCap aria-hidden />
        {pending('coach') ? 'Starting…' : 'Coach me'}
      </Button>
      <Button size="sm" variant="outline" disabled title="Video lessons are coming" className="border-dashed">
        <CirclePlay aria-hidden />
        Lesson
      </Button>
    </span>
  )
}

function HowItWorks() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
          <CircleHelp className="size-3.5" aria-hidden />
          How this is worked out
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>How recommendations are worked out</DialogTitle>
          <DialogDescription>From your own results in the last 90 days. No AI decides this, and nobody else sees it.</DialogDescription>
        </DialogHeader>
        <ul className="grid list-disc gap-2 pl-5 text-sm">
          <li>
            Each result counts by how much it says about you: an interviewer's review counts most, then an AI practice interview, then a
            coach session, then a drill.
          </li>
          <li>Newer results count more. A result counts half after 30 days, and stops counting after 90.</li>
          <li>
            Each topic starts from an average, so a single bad drill doesn't mark it weak. With more results, the strength moves to what
            you actually scored.
          </li>
          <li>A topic below 50% is a weak spot. The 3 weakest are shown, each with the result that pulled it down most.</li>
          <li>Your own focus topics always show, whatever the numbers say. Topics you type in yourself aren't counted.</li>
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function FocusRow({
  data,
  focus,
  busy,
  onStart,
  onFocusChange,
}: {
  data: PrepOverview['recommended']
  focus: string[]
  busy: PrepStart | null
  onStart: (s: PrepStart) => void
  onFocusChange: (topics: string[]) => void
}) {
  const unpinned = (list: readonly string[]) => list.filter((t) => !focus.includes(t))
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-4">
      {focus.length === 0 && (
        <span className="text-sm text-muted-foreground">Pin up to {MAX_FOCUS} topics you want to work on. They stay here whatever your results say.</span>
      )}
      {data.focus.map((t) => (
        <span key={t.topic} className="inline-flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
          <Pin className="size-3.5 text-brand" aria-hidden />
          <span className="font-medium">{t.topic}</span>
          <StrengthBar strength={t.strength} className="w-12" />
          <span className="mx-0.5 h-4 w-px bg-border" />
          {t.kind === 'technical' && (
            <button type="button" disabled={!!busy} className="text-brand hover:underline disabled:opacity-50" onClick={() => onStart({ mode: 'drill', topic: t.topic, level: t.level })}>
              Drill
            </button>
          )}
          <button
            type="button"
            disabled={!!busy}
            className="text-brand hover:underline disabled:opacity-50"
            onClick={() => onStart({ mode: 'coach', topic: t.topic, level: t.level, focus: t.focus, technical: t.kind === 'technical' })}
          >
            Coach
          </button>
          <button type="button" aria-label={`Unpin ${t.topic}`} className="text-muted-foreground hover:text-foreground" onClick={() => onFocusChange(focus.filter((f) => f !== t.topic))}>
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {focus.length < MAX_FOCUS && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed px-3 text-sm text-muted-foreground hover:bg-muted">
              <Plus className="size-4" aria-hidden />
              Pin a topic
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
            <DropdownMenuLabel>Technical</DropdownMenuLabel>
            {unpinned(TOPICS.technical).map((t) => (
              <DropdownMenuItem key={t} onSelect={() => onFocusChange([...focus, t])}>
                {t}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Behavioural</DropdownMenuLabel>
            {unpinned(TOPICS.behavioural).map((t) => (
              <DropdownMenuItem key={t} onSelect={() => onFocusChange([...focus, t])}>
                {t}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/** Everything tailored to the candidate, below the free choice. */
export function Recommended({
  data,
  focus,
  busy,
  onStart,
  onFocusChange,
}: {
  data: PrepOverview['recommended']
  focus: string[]
  busy: PrepStart | null
  onStart: (s: PrepStart) => void
  onFocusChange: (topics: string[]) => void
}) {
  const judged = data.topics.some((t) => t.strength !== null)
  return (
    <section className="mt-8" aria-labelledby="recommended">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="recommended" className="flex items-center gap-2 text-lg font-semibold">
            <Compass className="size-5 text-brand" aria-hidden />
            Recommended for you
          </h2>
          <p className="text-sm text-muted-foreground">Tailored from your practice interviews, interviewer reviews and prep in the last 90 days.</p>
        </div>
        <HowItWorks />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <SubHead icon={<Pin />} title="Your focus" hint={`up to ${MAX_FOCUS}`} />
        <FocusRow data={data} focus={focus} busy={busy} onStart={onStart} onFocusChange={onFocusChange} />

        <SubHead icon={<Target />} title="Weak spots" hint={data.suggestions.length ? 'weakest first' : undefined} />
        {data.suggestions.length === 0 ? (
          <div className="flex gap-3 border-t px-5 py-5 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">
              {judged
                ? 'No weak spots right now. Nice. Keep practising, and anything that slips shows up here with the reason.'
                : "Nothing to suggest yet. Take a drill or an AI practice interview: your weak spots show here once there's enough to go on."}
            </p>
          </div>
        ) : (
          data.suggestions.map((t, i) => (
            <div key={t.topic} className="grid gap-3 border-t px-5 py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="font-heading text-xl font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t.topic}</span>
                  <span className="text-xs text-muted-foreground">
                    {LEVEL_LABEL[t.level]}
                    {t.focus && ` · focus: ${t.focus.toLowerCase()}`}
                  </span>
                  <StrengthBar strength={t.strength} />
                </div>
                {t.reason && (
                  <p className="text-sm text-muted-foreground">
                    {t.reason.text}, {formatDay(t.reason.at, { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>
              <Actions t={t} busy={busy} onStart={onStart} />
            </div>
          ))
        )}

        <details className="group border-t">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium hover:bg-muted/50">
            <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
            All your topics
            <span className="font-normal text-muted-foreground">strength over the last 90 days</span>
            <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid gap-4 px-5 pb-5">
            {(['technical', 'behavioural'] as const).map((kind) => (
              <div key={kind}>
                <div className="mb-2 text-xs font-medium text-muted-foreground">{kind === 'technical' ? 'Technical' : 'Behavioural · coach only'}</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {data.topics
                    .filter((t) => t.kind === kind)
                    .map((t) => (
                      <div key={t.topic} className={cn('flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5', t.weak && 'border-danger/30')}>
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                          {focus.includes(t.topic) && <Pin className="size-3.5 shrink-0 text-brand" aria-label="Your focus" />}
                          <span className="truncate">{t.topic}</span>
                        </span>
                        <StrengthBar strength={t.strength} className="w-12" />
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  )
}
