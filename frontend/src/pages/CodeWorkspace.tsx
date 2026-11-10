import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlarmClock,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  CloudAlert,
  CloudCheck,
  EyeOff,
  Flag,
  Loader2,
  Play,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PromptText } from '@/components/contest/bits'
import { WorkspaceTopBar } from '@/components/contest/WorkspaceTopBar'
import { LanguagePicker, VerdictGrid, VerdictLegend } from '@/components/code/bits'
import { useNow } from '@/hooks/useNow'
import { useAutosave } from '@/hooks/useAutosave'
import { useRunner } from '@/hooks/useRunner'
import { judge } from '@/lib/sandbox/compare'
import { RUN_LIMITS } from '@/lib/sandbox/runner'
import { VERDICT_LABEL } from '@/lib/sandbox/labels'
import { LANGUAGE_LABEL } from '@/lib/sandbox/types'
import type { CodeLanguage, RunResult, TestVerdict } from '@/lib/sandbox/types'
import { listSubmissions, saveCodeDraft, submitCode, submitContest } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { clock, countdown } from '@/lib/contest-time'
import { cn } from '@/lib/utils'
import type { CodeQuestionView, Submission, Workspace } from '@/types'

const CodeEditor = lazy(() => import('@/components/code/CodeEditor'))

type Programs = Record<string, { language: CodeLanguage; text: Partial<Record<CodeLanguage, string>> }>
type ExampleRun = RunResult & { judged: TestVerdict; input: string; expected: string }

const pending = (s?: Submission) => s?.status === 'queued' || s?.status === 'running'

/**
 * A code contest's workspace, in the room's "call first" layout: the
 * problems across the top, the editor, and the problem and submissions in a
 * dock. Run checks the examples here in the browser; Submit is judged on the
 * server against hidden tests, and the last submission for each counts.
 */
export function CodeWorkspace({ ws }: { ws: Workspace }) {
  const contestId = ws.contest._id
  const questions = ws.questions as CodeQuestionView[]
  const queryClient = useQueryClient()
  const [offset] = useState(() => new Date(ws.serverNow).getTime() - Date.now())
  const now = useNow(500, offset)
  const start = new Date(ws.contest.startAt).getTime()
  const end = new Date(ws.contest.endAt).getTime()
  const elapsedPct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))

  const [finishedAt, setFinishedAt] = useState(ws.entry.submittedAt)
  const [confirming, setConfirming] = useState(false)
  const [index, setIndex] = useState(0)
  const [dock, setDock] = useState<'problem' | 'submissions'>('problem')
  const [panel, setPanel] = useState<'examples' | 'custom'>('examples')
  const [latest, setLatest] = useState<Record<string, Submission>>(ws.latest)
  const [examples, setExamples] = useState<Record<string, ExampleRun[]>>({})
  const [custom, setCustom] = useState<{ input: string; result: RunResult | null }>({ input: '', result: null })
  const [running, setRunning] = useState(false)
  const runner = useRunner()

  const [programs, setPrograms] = useState<Programs>(() =>
    Object.fromEntries(
      questions.map((q) => {
        const draft = ws.drafts[q._id]
        return [q._id, { language: draft?.language ?? 'python', text: draft ? { [draft.language]: draft.code } : {} }]
      }),
    ),
  )

  const q = questions[index]
  const program = programs[q._id]
  const code = program.text[program.language] ?? q.starterCode[program.language] ?? ''
  const timeUp = now >= end
  const done = Boolean(finishedAt) || timeUp

  const saveState = useAutosave(
    { questionId: q._id, language: program.language, code },
    (draft) => saveCodeDraft(contestId, draft.questionId, { language: draft.language, code: draft.code }),
    { delayMs: 1_000, enabled: !done },
  )

  const submissions = useQuery({
    queryKey: ['contest', contestId, 'submissions', q._id],
    queryFn: () => listSubmissions(contestId, q._id),
    enabled: dock === 'submissions' || pending(latest[q._id]),
    // Poll while the judge is working on one.
    refetchInterval: (query) => (pending(query.state.data?.[0]) ? 1_000 : false),
  })
  // The newest submission from the server, as the judge updates it.
  useEffect(() => {
    const newest = submissions.data?.[0]
    // oxlint-disable-next-line react/set-state-in-effect
    if (newest) setLatest((prev) => ({ ...prev, [newest.questionId]: newest }))
  }, [submissions.data])

  const submit = useMutation({
    mutationFn: () => submitCode(contestId, q._id, { language: program.language, code }),
    onSuccess: (sub) => {
      setLatest((prev) => ({ ...prev, [sub.questionId]: sub }))
      setDock('submissions')
      void queryClient.invalidateQueries({ queryKey: ['contest', contestId, 'submissions', sub.questionId] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not submit')),
  })

  const finish = useMutation({
    mutationFn: () => submitContest(contestId),
    onSuccess: (res) => {
      setFinishedAt(res.submittedAt)
      setConfirming(false)
      void queryClient.invalidateQueries({ queryKey: ['contest', contestId] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not finish')),
  })

  const setCode = (text: string) =>
    setPrograms((p) => ({ ...p, [q._id]: { ...p[q._id], text: { ...p[q._id].text, [p[q._id].language]: text } } }))
  const setLanguage = (language: CodeLanguage) => setPrograms((p) => ({ ...p, [q._id]: { ...p[q._id], language } }))
  const limits = { timeMs: q.timeLimitMs, memoryBytes: RUN_LIMITS.memoryBytes, outputBytes: RUN_LIMITS.outputBytes }

  const run = async () => {
    if (running) return
    setRunning(true)
    try {
      if (panel === 'custom') {
        const result = await runner.run({ language: program.language, code, stdin: custom.input, limits })
        setCustom((c) => ({ ...c, result }))
        return
      }
      const results: ExampleRun[] = []
      for (const ex of q.examples) {
        const result = await runner.run({ language: program.language, code, stdin: ex.input, limits })
        results.push({ ...result, judged: judge(result, ex.output), input: ex.input, expected: ex.output })
      }
      setExamples((prev) => ({ ...prev, [q._id]: results }))
    } finally {
      setRunning(false)
    }
  }

  if (done) {
    return <DoneScreen ws={ws} questions={questions} latest={latest} finishedAt={finishedAt} pct={finishedAt ? elapsedPct : 100} />
  }

  return (
    <div className="min-h-svh bg-background">
      <WorkspaceTopBar title={ws.contest.title} endAt={ws.contest.endAt} contestId={contestId} pct={elapsedPct}>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5" role="timer" aria-label="Time left">
            <Timer className="size-4 text-brand" aria-hidden />
            <span className="font-heading text-lg leading-none font-semibold text-brand tabular-nums">{countdown(end - now)}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">left</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            <Flag aria-hidden />
            Finish
          </Button>
        </div>
      </WorkspaceTopBar>

      <div className="p-3 pb-32 sm:p-4 sm:pb-32">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Problems">
          {questions.map((question, i) => (
            <ProblemCard
              key={question._id}
              q={question}
              n={i + 1}
              on={i === index}
              latest={latest[question._id]}
              onClick={() => {
                setIndex(i)
                setCustom((c) => ({ ...c, result: null }))
              }}
            />
          ))}
        </div>

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="flex flex-col overflow-hidden rounded-xl border bg-card lg:h-[calc(100svh-15.5rem)] lg:min-h-[30rem]">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <LanguagePicker value={program.language} onChange={setLanguage} />
              <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
                <ShieldCheck className="size-3.5 text-brand" aria-hidden />
                Run checks the examples in your browser. Submit is judged on our server.
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label="Reset to the starter code"
                title="Reset to the starter code"
                onClick={() => setCode(q.starterCode[program.language] ?? '')}
              >
                <RotateCcw aria-hidden />
              </Button>
            </div>
            <div className="min-h-64 flex-1 overflow-auto">
              <Suspense fallback={<Skeleton className="m-3 h-48" />}>
                <CodeEditor
                  key={q._id}
                  value={code}
                  language={program.language}
                  onChange={setCode}
                  onRun={() => void run()}
                  className="h-full"
                  ariaLabel={`Code for problem ${index + 1}`}
                />
              </Suspense>
            </div>
            <RunPanel
              panel={panel}
              onPanel={setPanel}
              runs={examples[q._id]}
              running={running}
              custom={custom}
              onCustomInput={(input) => setCustom((c) => ({ ...c, input }))}
            />
          </section>

          <section className="flex flex-col overflow-hidden rounded-xl border bg-card lg:h-[calc(100svh-15.5rem)] lg:min-h-[30rem]">
            <div role="tablist" className="flex border-b px-2 text-sm">
              {(['problem', 'submissions'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={dock === t}
                  onClick={() => setDock(t)}
                  className={cn(
                    'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5',
                    dock === t ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'problem' ? 'Problem' : 'Submissions'}
                  {t === 'submissions' && submissions.data && (
                    <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{submissions.data.length}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {dock === 'problem' ? <ProblemTab q={q} n={index + 1} /> : <SubmissionsTab q={q} list={submissions.data} loading={submissions.isPending} />}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card p-1.5 shadow-sm">
        <span className="hidden items-center gap-1.5 px-2 text-xs text-muted-foreground sm:flex">
          {saveState === 'failed' ? (
            <>
              <CloudAlert className="size-3.5 text-danger" aria-hidden />
              Not saved
            </>
          ) : saveState === 'saved' ? (
            <>
              <CloudCheck className="size-3.5 text-brand" aria-hidden />
              Saved
            </>
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Saving
            </>
          )}
        </span>
        <Button variant="outline" className="h-9 rounded-full px-4" onClick={() => void run()} disabled={running} title="Run (Ctrl+Enter)">
          {running ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          Run
        </Button>
        <Button
          className="h-9 rounded-full px-4"
          onClick={() => submit.mutate()}
          disabled={submit.isPending || pending(latest[q._id])}
        >
          {pending(latest[q._id]) ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {pending(latest[q._id]) ? 'Judging…' : 'Submit'}
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finish the contest?</DialogTitle>
            <DialogDescription>
              You can't submit again after finishing. Your last judged submission for each problem counts. {countdown(end - now)} is
              left.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep working
            </Button>
            <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
              {finish.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Flag aria-hidden />}
              Finish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** One problem in the strip along the top: its points and latest result. */
function ProblemCard({
  q,
  n,
  on,
  latest,
  onClick,
}: {
  q: CodeQuestionView
  n: number
  on: boolean
  latest?: Submission
  onClick: () => void
}) {
  const earned = latest?.status === 'done' ? latest.points : null
  const status = !latest ? (
    <span className="text-muted-foreground">Not submitted</span>
  ) : pending(latest) ? (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Loader2 className="size-3 animate-spin" aria-hidden />
      Judging
    </span>
  ) : latest.status === 'failed' ? (
    <span className="text-danger">Couldn't judge</span>
  ) : (
    <span className={cn(latest.passed === latest.total && 'text-brand')}>
      {latest.passed} of {latest.total} tests
    </span>
  )
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={cn('grid w-56 shrink-0 gap-2 rounded-lg border bg-card p-3 text-left', on ? 'border-primary ring-2 ring-primary/30' : 'hover:bg-muted/60')}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-md font-heading text-xs font-semibold tabular-nums',
            on ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-brand',
          )}
        >
          {n}
        </span>
        <span className="truncate text-sm font-medium">{q.title}</span>
      </span>
      <span className="flex items-center justify-between text-xs">
        {status}
        <span className="font-heading text-sm font-semibold tabular-nums">
          {earned ?? '–'}
          <span className="text-xs font-normal text-muted-foreground">/{q.points}</span>
        </span>
      </span>
      <span className="h-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${((earned ?? 0) / q.points) * 100}%` }} />
      </span>
    </button>
  )
}

function Pre({ text, tone }: { text: string; tone?: 'good' | 'bad' }) {
  return (
    <pre
      className={cn(
        'max-h-40 overflow-auto rounded-md px-2.5 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap',
        tone === 'good' ? 'bg-primary/10' : tone === 'bad' ? 'bg-danger/10' : 'bg-muted',
      )}
    >
      {text}
    </pre>
  )
}

/** Under the editor: Run's results on the examples, or a custom input. */
function RunPanel({
  panel,
  onPanel,
  runs,
  running,
  custom,
  onCustomInput,
}: {
  panel: 'examples' | 'custom'
  onPanel: (panel: 'examples' | 'custom') => void
  runs?: ExampleRun[]
  running: boolean
  custom: { input: string; result: RunResult | null }
  onCustomInput: (input: string) => void
}) {
  const [openRow, setOpenRow] = useState<number | null>(null)
  const passed = runs?.filter((r) => r.judged === 'passed').length ?? 0
  // Open the first failing example after each run.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setOpenRow(runs ? runs.findIndex((r) => r.judged !== 'passed') : null)
  }, [runs])

  return (
    <div className="max-h-[45%] overflow-y-auto border-t">
      <div className="flex items-center gap-1 border-b px-2 text-sm">
        {(['examples', 'custom'] as const).map((p) => (
          <button
            key={p}
            onClick={() => onPanel(p)}
            className={cn('border-b-2 px-3 py-2', panel === p ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {p === 'examples' ? 'Examples' : 'Custom input'}
          </button>
        ))}
        <span className="ml-auto pr-2 text-xs text-muted-foreground">
          {running ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Running…
            </span>
          ) : (
            panel === 'examples' &&
            runs && (
              <span className={cn('font-medium', passed === runs.length ? 'text-brand' : 'text-danger')}>
                {passed} of {runs.length} passed
              </span>
            )
          )}
        </span>
      </div>
      {panel === 'examples' ? (
        !runs ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Run checks your code against the examples in the problem.</p>
        ) : (
          runs.map((r, i) => {
            const ok = r.judged === 'passed'
            const open = openRow === i
            return (
              <div key={i} className="border-t first:border-t-0">
                <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60" onClick={() => setOpenRow(open ? null : i)}>
                  {ok ? <CircleCheck className="size-4 text-brand" aria-hidden /> : <CircleX className="size-4 text-danger" aria-hidden />}
                  <span className="font-medium">Example {i + 1}</span>
                  <span className="text-muted-foreground">{VERDICT_LABEL[r.judged]}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{r.ms} ms</span>
                  {open ? <ChevronDown className="size-4 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
                </button>
                {open && (
                  <div className="grid gap-2 px-3 pb-3 sm:grid-cols-3">
                    <div className="grid content-start gap-1">
                      <span className="text-xs text-muted-foreground">Input</span>
                      <Pre text={r.input} />
                    </div>
                    <div className="grid content-start gap-1">
                      <span className="text-xs text-muted-foreground">Expected</span>
                      <Pre text={r.expected} tone="good" />
                    </div>
                    <div className="grid content-start gap-1">
                      <span className="text-xs text-muted-foreground">Your output</span>
                      <Pre text={r.stdout + (r.stderr ? `\n${r.stderr}` : '')} tone={ok ? undefined : 'bad'} />
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )
      ) : (
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          <label className="grid content-start gap-1">
            <span className="text-xs text-muted-foreground">Input</span>
            <textarea
              value={custom.input}
              onChange={(e) => onCustomInput(e.target.value)}
              spellCheck={false}
              rows={4}
              className="rounded-md border bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus:border-primary"
            />
          </label>
          <div className="grid content-start gap-1">
            <span className="text-xs text-muted-foreground">Output</span>
            {custom.result ? (
              <Pre text={custom.result.stdout + (custom.result.stderr ? `\n${custom.result.stderr}` : '')} tone={custom.result.verdict === 'ok' ? undefined : 'bad'} />
            ) : (
              <p className="text-xs text-muted-foreground">Run to see what your program prints.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProblemTab({ q, n }: { q: CodeQuestionView; n: number }) {
  const each = q.hiddenCount ? Math.round((q.points / q.hiddenCount) * 100) / 100 : 0
  return (
    <div className="grid content-start gap-5 p-4">
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {n}. {q.title}
          </h2>
          <span className="ml-auto rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums">{q.points} pts</span>
        </div>
        <PromptText text={q.prompt} className="text-sm leading-relaxed" />
      </div>
      {q.examples.map((ex, i) => (
        <section key={i} className="grid gap-1.5">
          <h3 className="font-sans text-sm font-semibold tracking-normal">Example {i + 1}</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid content-start gap-1">
              <span className="text-xs text-muted-foreground">Input</span>
              <Pre text={ex.input} />
            </div>
            <div className="grid content-start gap-1">
              <span className="text-xs text-muted-foreground">Output</span>
              <Pre text={ex.output} />
            </div>
          </div>
        </section>
      ))}
      <div className="grid gap-1.5 rounded-lg bg-primary/10 p-3 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <Scale className="size-3.5 text-brand" aria-hidden />
          How it's scored
        </span>
        <span className="text-muted-foreground">
          {q.hiddenCount} hidden tests, {each} points each. {q.timeLimitMs / 1000} seconds and 256 MB per test. Your last submission
          counts.
        </span>
      </div>
    </div>
  )
}

function SubmissionsTab({ q, list, loading }: { q: CodeQuestionView; list?: Submission[]; loading: boolean }) {
  if (loading) return <Skeleton className="m-4 h-32" />
  if (!list?.length) {
    return <p className="p-4 text-sm text-muted-foreground">No submissions yet. Submit to have your code judged on the hidden tests.</p>
  }
  return (
    <div className="grid content-start gap-3 p-4">
      <ol className="grid gap-2">
        {list.map((s, i) => (
          <li key={s._id} className={cn('grid gap-3 rounded-lg border p-3', i === 0 && 'border-primary/50')}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Submission {list.length - i}</span>
              <span className="text-xs text-muted-foreground">
                {LANGUAGE_LABEL[s.language]} · {clock(s.createdAt)}
              </span>
              {i === 0 ? (
                <span className="ml-auto rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-brand">Counts</span>
              ) : (
                <span className="ml-auto text-[11px] text-muted-foreground">Replaced</span>
              )}
            </div>
            {pending(s) ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
                Judging on our server
              </div>
            ) : s.status === 'failed' ? (
              <p className="text-sm text-danger">The judge couldn't run this one. It doesn't count against you.</p>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-2xl font-semibold tabular-nums">
                  {s.points}
                  <span className="text-sm font-normal text-muted-foreground">/{q.points}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {s.passed} of {s.total} hidden tests passed
                </span>
              </div>
            )}
            {!pending(s) && s.status !== 'failed' && <VerdictGrid verdicts={s.verdicts.map((v) => v.verdict)} />}
          </li>
        ))}
      </ol>
      <VerdictLegend />
      <p className="flex gap-2 text-xs text-muted-foreground">
        <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Hidden tests stay on our server. You see whether each one passed, not what it was.
      </p>
    </div>
  )
}

function DoneScreen({
  ws,
  questions,
  latest,
  finishedAt,
  pct,
}: {
  ws: Workspace
  questions: CodeQuestionView[]
  latest: Record<string, Submission>
  finishedAt: string | null
  pct: number
}) {
  const submitted = questions.filter((q) => latest[q._id]).length
  return (
    <div className="min-h-svh bg-background">
      <WorkspaceTopBar title={ws.contest.title} endAt={ws.contest.endAt} contestId={ws.contest._id} pct={pct}>
        <span className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
          <Flag className="size-3.5" aria-hidden />
          {finishedAt ? 'Finished' : 'Ended'}
        </span>
      </WorkspaceTopBar>
      <main className="mx-auto grid max-w-xl gap-6 px-4 py-16 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/15 text-brand">
          {finishedAt ? <CircleCheck className="size-7" aria-hidden /> : <AlarmClock className="size-7" aria-hidden />}
        </span>
        <h1 className="text-3xl font-semibold">{finishedAt ? 'Finished' : "Time's up"}</h1>
        <p className="text-muted-foreground">
          You submitted to{' '}
          <span className="font-medium text-foreground">
            {submitted} of {questions.length}
          </span>{' '}
          problems. Your last judged submission for each counts. Results open once the contest ends at {clock(ws.contest.endAt)} and
          the judge has finished.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="w-full" asChild>
            <Link to={`/contests/${ws.contest._id}`}>Back to contest page</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/contests">Browse contests</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
