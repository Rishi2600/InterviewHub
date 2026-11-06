import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  CloudAlert,
  CloudCheck,
  Copy,
  Eye,
  ExternalLink,
  ListChecks,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { LiveDot } from '@/components/common/LiveDot'
import { ErrorState } from '@/components/common/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel, PhaseBadge, PromptText, Stat } from '@/components/contest/bits'
import { useAutosave } from '@/hooks/useAutosave'
import type { AutosaveState } from '@/hooks/useAutosave'
import { useNow } from '@/hooks/useNow'
import { deleteContest, getContestEditor, publishContest, saveContestQuestions, updateContest } from '@/lib/endpoints'
import type { ContestDetailsInput } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { clock, fromInputs, length, toDateInput, toTimeInput } from '@/lib/contest-time'
import { LIMITS } from '@/lib/limits'
import { cn } from '@/lib/utils'
import type { Contest, EditorQuestion, EditorView, QuestionKind } from '@/types'

const C = LIMITS.contest
const LENGTHS = [10, 15, 20, 30, 40, 45, 60, 90, 120, 180, 240, 360, 720, 1440]

/** A short id for a new option, unique within its question. */
const optionId = () => Math.random().toString(36).slice(2, 10)

const newQuestion = (kind: QuestionKind): EditorQuestion => ({
  kind,
  prompt: '',
  options: [
    { id: optionId(), text: '' },
    { id: optionId(), text: '' },
  ],
  correctOptionIds: [],
  points: 1,
  explanation: '',
})

/** The host's editor: details, questions and publishing, saved as you type. */
export function ContestEditor() {
  const { id = '' } = useParams()
  const editor = useQuery({ queryKey: ['contest', id, 'editor'], queryFn: () => getContestEditor(id) })
  if (editor.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-[32rem] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  if (editor.isError) {
    return <ErrorState title="Contest not found" message={errorMessage(editor.error)} onRetry={() => void editor.refetch()} />
  }
  // Keyed so the form starts from the server once, then owns its state.
  return <Editor key={id} view={editor.data} />
}

interface DetailsForm {
  title: string
  description: string
  date: string
  time: string
  durationMinutes: number
  capacityOn: boolean
  capacity: number
}

const formFrom = (c: Contest): DetailsForm => ({
  title: c.title,
  description: c.description,
  date: toDateInput(c.startAt),
  time: toTimeInput(c.startAt),
  durationMinutes: c.durationMinutes ?? 60,
  capacityOn: c.capacity !== null,
  capacity: c.capacity ?? 100,
})

function Editor({ view }: { view: EditorView }) {
  const contest = view.contest
  const id = contest._id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const now = useNow(30_000)
  const [form, setForm] = useState<DetailsForm>(() => formFrom(contest))
  const [questions, setQuestions] = useState<EditorQuestion[]>(view.questions)
  const [open, setOpen] = useState(view.questions.length > 0 ? 0 : -1)
  const [preview, setPreview] = useState(false)

  const upcoming = contest.status === 'published' && !!contest.startAt && now < new Date(contest.startAt).getTime()
  const editable = contest.status === 'draft' || upcoming
  const phase =
    contest.status === 'draft'
      ? 'draft'
      : contest.status === 'cancelled'
        ? 'cancelled'
        : upcoming
          ? 'upcoming'
          : contest.endAt && now < new Date(contest.endAt).getTime()
            ? 'live'
            : 'ended'

  // Fresh checks and counts after each save, without touching the form.
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ['contest', id] }), [queryClient, id])

  const detailsInput = useMemo<ContestDetailsInput>(
    () => ({
      // A too-short title is not sent; the field shows why.
      ...(form.title.trim().length >= LIMITS.title.min && { title: form.title.trim() }),
      description: form.description,
      startAt: fromInputs(form.date, form.time),
      durationMinutes: form.durationMinutes,
      capacity: form.capacityOn ? Math.max(1, Math.min(C.capacity, Math.floor(form.capacity) || 1)) : null,
    }),
    [form],
  )
  const detailsState = useAutosave(
    detailsInput,
    async (body) => {
      try {
        await updateContest(id, body)
        await refresh()
      } catch (err) {
        toast.error(errorMessage(err, 'Could not save the details'))
        throw err
      }
    },
    { enabled: editable },
  )
  const questionsState = useAutosave(
    questions,
    async (list) => {
      try {
        await saveContestQuestions(id, list)
        await refresh()
      } catch (err) {
        toast.error(errorMessage(err, 'Could not save the questions'))
        throw err
      }
    },
    { delayMs: 1000, enabled: editable },
  )
  const saveState: AutosaveState = [detailsState, questionsState].includes('failed')
    ? 'failed'
    : [detailsState, questionsState].includes('saving')
      ? 'saving'
      : [detailsState, questionsState].includes('pending')
        ? 'pending'
        : 'saved'

  const publish = useMutation({
    mutationFn: () => publishContest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contests'] })
      void refresh()
      toast.success('Published. It is on the contests page now.')
      navigate(`/contests/${id}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not publish')),
  })
  const remove = useMutation({
    mutationFn: () => deleteContest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contests'] })
      toast.success('Draft deleted')
      navigate('/contests')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not delete')),
  })

  const update = (i: number, patch: Partial<EditorQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const move = (i: number, by: -1 | 1) => {
    const j = i + by
    if (j < 0 || j >= questions.length) return
    setQuestions((qs) => {
      const next = [...qs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setOpen(j)
  }
  const add = (kind: QuestionKind) => {
    if (questions.length >= C.questions) return
    setQuestions((qs) => [...qs, newQuestion(kind)])
    setOpen(questions.length)
  }

  const failing = view.checks.filter((c) => !c.ok)
  const ready = failing.length === 0 && saveState === 'saved'
  const endsAt = (() => {
    const start = fromInputs(form.date, form.time)
    return start ? new Date(new Date(start).getTime() + form.durationMinutes * 60_000) : null
  })()

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <Link to="/contests" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Contests
            </Link>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="truncate font-medium">{editable ? (contest.status === 'draft' ? 'Edit draft' : 'Edit contest') : contest.title}</span>
          </span>
        }
      >
        {editable ? (
          <>
            <SaveBadge state={saveState} />
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => setPreview(true)} disabled={questions.length === 0}>
              <Eye aria-hidden />
              Preview
            </Button>
            {contest.status === 'draft' && (
              <Button size="sm" onClick={() => publish.mutate()} disabled={!ready || publish.isPending}>
                {publish.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                Publish
              </Button>
            )}
          </>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/contests/${id}`}>
              <ExternalLink aria-hidden />
              View contest
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-6">
          {!editable && (
            <div className="flex gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
              {phase === 'live' ? <LiveDot className="mt-1.5" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
              <p>
                {phase === 'live'
                  ? `This contest is live, so nothing can be changed. It ends at ${clock(contest.endAt!)}. Editing was open until it started.`
                  : phase === 'cancelled'
                    ? 'This contest was cancelled, so nothing can be changed.'
                    : 'This contest has ended, so nothing can be changed.'}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{form.title || 'Untitled contest'}</h1>
            <PhaseBadge phase={phase} />
          </div>

          <Panel title="Details">
            <fieldset disabled={!editable} className="grid gap-4 p-5">
              <Field label="Title" hint={`Shown on the contests page. Up to ${LIMITS.title.max} characters.`}>
                <Input
                  value={form.title}
                  maxLength={LIMITS.title.max}
                  aria-invalid={form.title.trim().length < LIMITS.title.min}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field label="Description" hint="What the contest covers and who it is for.">
                <Textarea
                  value={form.description}
                  maxLength={LIMITS.text}
                  rows={4}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Start date">
                  <IconInput icon={<Calendar />}>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="pl-9" />
                  </IconInput>
                </Field>
                <Field label="Start time">
                  <IconInput icon={<Clock />}>
                    <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="pl-9 tabular-nums" />
                  </IconInput>
                </Field>
                <Field label="Length" hint={endsAt ? `Ends at ${clock(endsAt)}` : undefined}>
                  <select
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                  >
                    {[...new Set([...LENGTHS, form.durationMinutes])]
                      .sort((a, b) => a - b)
                      .map((m) => (
                        <option key={m} value={m}>
                          {length(m)}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <label className="flex flex-1 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={form.capacityOn}
                    onChange={(e) => setForm({ ...form, capacityOn: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium">Limit entrants</span>
                    <span className="block text-xs text-muted-foreground">Leave off to let anyone join.</span>
                  </span>
                </label>
                {form.capacityOn && (
                  <Input
                    type="number"
                    min={1}
                    max={C.capacity}
                    value={form.capacity}
                    aria-label="Most entrants"
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-28 tabular-nums"
                  />
                )}
              </div>
            </fieldset>
          </Panel>

          <Panel
            title={
              <>
                Questions{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {questions.length} · {questions.reduce((a, q) => a + q.points, 0)} points
                </span>
              </>
            }
          >
            {questions.length === 0 && (
              <p className="px-5 pt-5 text-sm text-muted-foreground">No questions yet. Add the first one below.</p>
            )}
            <ol className="divide-y">
              {questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  q={q}
                  n={i + 1}
                  open={open === i}
                  editable={editable}
                  first={i === 0}
                  last={i === questions.length - 1}
                  onToggle={() => setOpen(open === i ? -1 : i)}
                  onChange={(patch) => update(i, patch)}
                  onMove={(by) => move(i, by)}
                  onDuplicate={() => {
                    if (questions.length >= C.questions) return
                    setQuestions((qs) => [
                      ...qs.slice(0, i + 1),
                      { ...q, _id: undefined, options: q.options.map((o) => ({ ...o })) },
                      ...qs.slice(i + 1),
                    ])
                    setOpen(i + 1)
                  }}
                  onDelete={() => {
                    setQuestions((qs) => qs.filter((_, j) => j !== i))
                    setOpen(-1)
                  }}
                />
              ))}
            </ol>
            {editable && (
              <div className="grid gap-2 border-t p-5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => add('single')} disabled={questions.length >= C.questions}>
                    <CircleDot aria-hidden />
                    Single choice question
                  </Button>
                  <Button variant="outline" onClick={() => add('multiple')} disabled={questions.length >= C.questions}>
                    <ListChecks aria-hidden />
                    Multiple choice question
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  1 to {C.questions} questions. Entrants see questions and options in a shuffled order.
                </p>
              </div>
            )}
          </Panel>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-24">
          {editable ? (
            <>
              <Panel
                title={contest.status === 'draft' ? (failing.length ? 'Before you publish' : 'Ready to publish') : 'Still publishable'}
                extra={
                  failing.length ? (
                    <span className="ml-auto text-xs text-danger">{failing.length} to fix</span>
                  ) : (
                    <CircleCheck className="ml-auto size-4 text-brand" aria-hidden />
                  )
                }
              >
                <ul className="grid gap-2.5 p-5 text-sm">
                  {view.checks.map((c) => (
                    <li key={c.label} className="flex gap-2">
                      {c.ok ? (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      ) : (
                        <CircleX className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                      )}
                      <span>
                        {c.label}
                        {!c.ok && c.detail && <span className="block text-xs text-muted-foreground">{c.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {contest.status === 'draft' && (
                  <div className="grid gap-2 border-t p-5">
                    <Button className="w-full" onClick={() => publish.mutate()} disabled={!ready || publish.isPending}>
                      {publish.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                      Publish
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      After publishing it appears on the contests page.
                      {endsAt && ` You can still edit it until ${clock(fromInputs(form.date, form.time)!)}.`}
                    </p>
                  </div>
                )}
              </Panel>
              {contest.status === 'draft' && view.usage && <QuotaCard usage={view.usage} />}
              {contest.status === 'draft' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="justify-self-start text-danger">
                      <Trash2 aria-hidden />
                      Delete draft
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                      <AlertDialogDescription>The draft and its questions are removed for good.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate()}>Delete draft</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          ) : (
            <Panel title={phase === 'live' ? 'Right now' : 'Entrants'} extra={phase === 'live' ? <LiveDot className="ml-1" /> : undefined}>
              <dl className="grid grid-cols-3 divide-x text-center">
                <Stat label="Entered" value={contest.entrantCount} />
                <Stat label="Started" value={contest.startedCount} />
                <Stat label="Submitted" value={contest.submittedCount} />
              </dl>
            </Panel>
          )}
        </aside>
      </div>

      <PreviewDialog open={preview} onOpenChange={setPreview} questions={questions} />
    </>
  )
}

/** A labelled control. The label wraps the control, so it names it for
 *  screen readers and a click on it focuses the control. */
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="grid gap-1.5">
        <span className="text-sm leading-none font-medium">{label}</span>
        {children}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function IconInput({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-2.5 left-3 text-muted-foreground [&_svg]:size-4">{icon}</span>
      {children}
    </div>
  )
}

function SaveBadge({ state }: { state: AutosaveState }) {
  if (state === 'failed') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-danger">
        <CloudAlert className="size-3.5" aria-hidden />
        Not saved
      </span>
    )
  }
  const busy = state === 'saving' || state === 'pending'
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex" aria-live="polite">
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CloudCheck className="size-3.5 text-brand" aria-hidden />}
      {busy ? 'Saving…' : 'Saved'}
    </span>
  )
}

function QuotaCard({ usage }: { usage: NonNullable<EditorView['usage']> }) {
  const left = Math.max(0, usage.limit - usage.used)
  const reset = new Date(usage.resetsAt).toLocaleDateString([], { day: 'numeric', month: 'long' })
  return (
    <Panel className="grid gap-2 p-5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Free contests this month</span>
        <span className="text-muted-foreground tabular-nums">
          {left} of {usage.limit} left
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: usage.limit }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < usage.used ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {left === 0
          ? `You've used them all. More open on ${reset}.`
          : left === 1
            ? `Publishing this uses your last one. Resets on ${reset}.`
            : `Resets on ${reset}.`}{' '}
        Cancelling before anyone joins gives one back.
      </p>
    </Panel>
  )
}

/** The first problem with a question, for its collapsed row. */
function issueOf(q: EditorQuestion): string | null {
  if (!q.prompt.trim()) return 'No question text'
  if (q.options.length < C.options.min) return 'Needs 2 options'
  if (q.options.some((o) => !o.text.trim())) return 'An option is empty'
  if (q.correctOptionIds.length === 0) return 'No correct option'
  return null
}

function QuestionEditor({
  q,
  n,
  open,
  editable,
  first,
  last,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  q: EditorQuestion
  n: number
  open: boolean
  editable: boolean
  first: boolean
  last: boolean
  onToggle: () => void
  onChange: (patch: Partial<EditorQuestion>) => void
  onMove: (by: -1 | 1) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const issue = issueOf(q)
  const multiple = q.kind === 'multiple'
  const correct = new Set(q.correctOptionIds)

  const setKind = (kind: QuestionKind) =>
    onChange({ kind, correctOptionIds: kind === 'single' ? q.correctOptionIds.slice(0, 1) : q.correctOptionIds })
  const mark = (id: string) =>
    onChange({
      correctOptionIds: multiple
        ? correct.has(id)
          ? q.correctOptionIds.filter((c) => c !== id)
          : [...q.correctOptionIds, id]
        : [id],
    })

  return (
    <li>
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">{n}</span>
        <button type="button" onClick={onToggle} className="grid min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="truncate text-sm font-medium">
            {q.prompt.trim().split('\n')[0] || <span className="text-muted-foreground">New question</span>}
          </span>
          {issue ? (
            <span className="flex items-center gap-1 text-xs text-danger">
              <CircleAlert className="size-3.5" aria-hidden />
              {issue}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {multiple ? 'Multiple' : 'Single'} · {q.points} pt{q.points > 1 ? 's' : ''}
            </span>
          )}
        </button>
        {editable && (
          <span className="flex shrink-0">
            <Button variant="ghost" size="icon-sm" onClick={() => onMove(-1)} disabled={first} aria-label="Move up">
              <ArrowUp aria-hidden />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onMove(1)} disabled={last} aria-label="Move down">
              <ArrowDown aria-hidden />
            </Button>
          </span>
        )}
        <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}>
          {open ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
      </div>
      {open && (
        <fieldset disabled={!editable} className="grid gap-4 border-t bg-muted/20 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
              {(['single', 'multiple'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn('rounded-md px-3 py-1 font-medium', q.kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground')}
                >
                  {k === 'single' ? 'Single choice' : 'Multiple choice'}
                </button>
              ))}
            </span>
            <span className="text-xs text-muted-foreground">
              {multiple ? `All or nothing: ${q.correctOptionIds.length} correct of ${q.options.length}.` : 'One correct option.'}
            </span>
          </div>
          <Field label="Question" hint="Wrap code in ``` on its own lines to show it as code.">
            <Textarea value={q.prompt} maxLength={LIMITS.text} rows={3} onChange={(e) => onChange({ prompt: e.target.value })} />
          </Field>
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <Label>Options</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {q.options.length} of {C.options.max}
              </span>
            </div>
            <ul className="grid gap-2">
              {q.options.map((o, i) => {
                const on = correct.has(o.id)
                return (
                  <li key={o.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      role={multiple ? 'checkbox' : 'radio'}
                      aria-checked={on}
                      aria-label={`Mark option ${i + 1} correct`}
                      onClick={() => mark(o.id)}
                      className={cn(
                        'flex h-9 w-24 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium',
                        on ? 'border-primary bg-primary/10 text-brand' : 'bg-card text-muted-foreground',
                      )}
                    >
                      {multiple ? (
                        <span className={cn('grid size-4 place-items-center rounded border', on && 'border-primary bg-primary text-primary-foreground')}>
                          {on && <CircleCheck className="size-3" aria-hidden />}
                        </span>
                      ) : (
                        <span className="grid size-4 place-items-center rounded-full border">
                          {on && <span className="size-2 rounded-full bg-primary" />}
                        </span>
                      )}
                      {on ? 'Correct' : 'Mark'}
                    </button>
                    <Input
                      value={o.text}
                      maxLength={C.optionText}
                      placeholder={`Option ${i + 1}`}
                      aria-invalid={!o.text.trim()}
                      onChange={(e) =>
                        onChange({ options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })
                      }
                    />
                    {editable && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove option ${i + 1}`}
                        disabled={q.options.length <= C.options.min}
                        onClick={() =>
                          onChange({
                            options: q.options.filter((x) => x.id !== o.id),
                            correctOptionIds: q.correctOptionIds.filter((c) => c !== o.id),
                          })
                        }
                      >
                        <X aria-hidden />
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
            {editable && q.options.length < C.options.max && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start text-brand"
                onClick={() => onChange({ options: [...q.options, { id: optionId(), text: '' }] })}
              >
                <Plus aria-hidden />
                Add option
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field label="Points">
              <Input
                type="number"
                min={C.points.min}
                max={C.points.max}
                value={q.points}
                className="tabular-nums"
                onChange={(e) =>
                  onChange({ points: Math.max(C.points.min, Math.min(C.points.max, Math.floor(Number(e.target.value)) || 1)) })
                }
              />
            </Field>
            <Field label="Explanation (optional)" hint="Shown with the correct answer after the end.">
              <Textarea value={q.explanation} maxLength={LIMITS.text} rows={2} onChange={(e) => onChange({ explanation: e.target.value })} />
            </Field>
          </div>
          {editable && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onDuplicate}>
                <Copy aria-hidden />
                Duplicate
              </Button>
              <Button variant="ghost" size="sm" className="text-danger" onClick={onDelete}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            </div>
          )}
        </fieldset>
      )}
    </li>
  )
}

/** The questions as entrants will see them (in the host's order here). */
function PreviewDialog({
  open,
  onOpenChange,
  questions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  questions: EditorQuestion[]
}) {
  const [i, setI] = useState(0)
  const q = questions[Math.min(i, questions.length - 1)]
  if (!q) return null
  const multiple = q.kind === 'multiple'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Question {Math.min(i, questions.length - 1) + 1} of {questions.length}
          </DialogTitle>
          <DialogDescription>Preview. Entrants see questions and options in their own shuffled order.</DialogDescription>
        </DialogHeader>
        <PromptText text={q.prompt || 'No question text yet.'} className="text-lg leading-snug font-medium" />
        <p className="text-sm text-muted-foreground">
          {multiple ? 'Select all that apply. Scores only if every correct option and no wrong one is picked.' : 'Pick one.'}
        </p>
        <ul className="grid gap-2">
          {q.options.map((o, n) => (
            <li key={o.id} className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm">
              <span className={cn('size-5 shrink-0 border', multiple ? 'rounded' : 'rounded-full')} />
              <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{'ABCDEF'[n]}</span>
              <span className="flex-1">{o.text || <span className="text-muted-foreground">Empty option</span>}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
            Previous
          </Button>
          <Button size="sm" onClick={() => setI((x) => Math.min(questions.length - 1, x + 1))} disabled={i >= questions.length - 1}>
            Next
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
