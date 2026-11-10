import { lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { LanguagePicker } from '@/components/code/bits'
import { CODE_LANGUAGES, LANGUAGE_LABEL } from '@/lib/sandbox/types'
import type { CodeLanguage } from '@/lib/sandbox/types'
import { LIMITS } from '@/lib/limits'
import { cn } from '@/lib/utils'
import type { CodeTest, EditorQuestion } from '@/types'

const CodeEditor = lazy(() => import('@/components/code/CodeEditor'))

const CL = LIMITS.code
const P = LIMITS.contest.points
const SECONDS = [1, 2, 3, 4, 5]

/** What still stops this question being published, if anything. */
function codeIssueOf(q: EditorQuestion): string | null {
  if (!q.title.trim() || !q.prompt.trim()) return 'No title or statement'
  if (!q.tests.some((t) => t.visible) || !q.tests.some((t) => !t.visible)) return 'Needs a visible and a hidden test'
  if (q.tests.some((t) => !t.output.trim())) return 'A test has no expected output'
  return null
}

function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function SmallEditor({
  value,
  language,
  onChange,
  readOnly,
  label,
}: {
  value: string
  language: CodeLanguage
  onChange: (value: string) => void
  readOnly: boolean
  label: string
}) {
  return (
    <div className="h-44 overflow-auto bg-card">
      <Suspense fallback={<Skeleton className="m-2 h-32" />}>
        <CodeEditor value={value} language={language} onChange={onChange} readOnly={readOnly} className="h-full" ariaLabel={label} />
      </Suspense>
    </div>
  )
}

/** One code question in the host's editor. */
export function CodeQuestionEditor({
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
  const [starterLanguage, setStarterLanguage] = useState<CodeLanguage>('python')
  const issue = codeIssueOf(q)
  const visible = q.tests.filter((t) => t.visible).length
  const hidden = q.tests.length - visible
  const each = hidden ? Math.round((q.points / hidden) * 100) / 100 : 0

  const setTest = (i: number, patch: Partial<CodeTest>) => onChange({ tests: q.tests.map((t, j) => (j === i ? { ...t, ...patch } : t)) })

  return (
    <li>
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">{n}</span>
        <button type="button" onClick={onToggle} className="grid min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="truncate text-sm font-medium">{q.title.trim() || <span className="text-muted-foreground">New code question</span>}</span>
          {issue ? (
            <span className="flex items-center gap-1 text-xs text-danger">
              <CircleAlert className="size-3.5" aria-hidden />
              {issue}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Code · {q.points} pts · {visible} visible + {hidden} hidden tests
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
        <fieldset disabled={!editable} className="grid gap-5 border-t bg-muted/20 px-5 py-4">
          <Field label="Title">
            <Input value={q.title} maxLength={LIMITS.title.max} placeholder="Merge intervals" onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label="Statement" hint="Say what the input looks like, what to print, and the limits. Visible tests appear under it as examples.">
            <Textarea value={q.prompt} maxLength={CL.statement} rows={6} onChange={(e) => onChange({ prompt: e.target.value })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Points" hint="Split evenly across hidden tests.">
              <Input
                type="number"
                min={P.min}
                max={P.max}
                value={q.points}
                className="tabular-nums"
                onChange={(e) => onChange({ points: Math.max(P.min, Math.min(P.max, Math.floor(Number(e.target.value)) || 1)) })}
              />
            </Field>
            <Field label="Time per test" hint="1 to 5 seconds.">
              <select
                value={q.timeLimitMs / 1000}
                onChange={(e) => onChange({ timeLimitMs: Number(e.target.value) * 1000 })}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              >
                {SECONDS.map((s) => (
                  <option key={s} value={s}>
                    {s} second{s > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Memory" hint="The same for every question.">
              <Input value="256 MB" disabled />
            </Field>
          </div>

          <Field
            label={
              <>
                Starter code <span className="font-normal text-muted-foreground">(optional)</span>
              </>
            }
            hint="Entrants start from this in each language. Leave a language empty for a blank editor."
          >
            <div className="overflow-hidden rounded-lg border">
              <div role="tablist" className="flex items-center gap-1 border-b bg-card px-2">
                {CODE_LANGUAGES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="tab"
                    aria-selected={starterLanguage === l}
                    onClick={() => setStarterLanguage(l)}
                    className={cn(
                      'border-b-2 px-2.5 py-2 text-xs font-medium',
                      starterLanguage === l ? 'border-primary' : 'border-transparent text-muted-foreground',
                    )}
                  >
                    {LANGUAGE_LABEL[l]}
                    {q.starterCode[l].trim() && <span className="ml-1 text-brand">•</span>}
                  </button>
                ))}
              </div>
              <SmallEditor
                key={starterLanguage}
                value={q.starterCode[starterLanguage]}
                language={starterLanguage}
                readOnly={!editable}
                label={`${LANGUAGE_LABEL[starterLanguage]} starter code`}
                onChange={(code) => onChange({ starterCode: { ...q.starterCode, [starterLanguage]: code } })}
              />
            </div>
          </Field>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <Label>Tests</Label>
              <span className="text-xs text-muted-foreground">
                {visible} visible, shown as examples · {hidden} hidden, judged on Submit
                {hidden > 0 && (
                  <>
                    {' · '}
                    <span className="font-medium text-foreground">{each} points each</span>
                  </>
                )}
              </span>
            </div>
            <ol className="grid gap-2">
              {q.tests.map((t, i) => (
                <li key={i} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start">
                  <span className="grid size-7 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted-foreground">Input</span>
                    <Textarea
                      value={t.input}
                      maxLength={CL.testBytes}
                      rows={Math.min(4, Math.max(2, t.input.split('\n').length))}
                      spellCheck={false}
                      className="font-mono text-xs"
                      onChange={(e) => setTest(i, { input: e.target.value })}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted-foreground">Expected output</span>
                    <Textarea
                      value={t.output}
                      maxLength={CL.testBytes}
                      rows={Math.min(4, Math.max(2, t.output.split('\n').length))}
                      spellCheck={false}
                      aria-invalid={!t.output.trim()}
                      className="font-mono text-xs"
                      onChange={(e) => setTest(i, { output: e.target.value })}
                    />
                  </label>
                  <div className="flex items-center gap-1 sm:pt-5">
                    <span className="inline-flex rounded-lg bg-muted p-0.5 text-xs" role="radiogroup" aria-label={`Test ${i + 1} visibility`}>
                      {([true, false] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          role="radio"
                          aria-checked={t.visible === v}
                          onClick={() => setTest(i, { visible: v })}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium',
                            t.visible === v ? 'bg-card shadow-sm' : 'text-muted-foreground',
                          )}
                        >
                          {v ? <Eye className="size-3" aria-hidden /> : <EyeOff className="size-3" aria-hidden />}
                          {v ? 'Visible' : 'Hidden'}
                        </button>
                      ))}
                    </span>
                    {editable && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove test ${i + 1}`}
                        onClick={() => onChange({ tests: q.tests.filter((_, j) => j !== i) })}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {editable && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start text-brand"
                disabled={q.tests.length >= CL.tests}
                onClick={() => onChange({ tests: [...q.tests, { input: '', output: '', visible: q.tests.length === 0 }] })}
              >
                <Plus aria-hidden />
                Add test
              </Button>
            )}
          </div>

          <Field
            label={
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" aria-hidden />
                Your answer <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
            }
            hint="Kept with the question for your records. Only you see it, and it isn't used for scoring."
          >
            {q.hostAnswer ? (
              <div className="overflow-hidden rounded-lg border">
                <div className="flex items-center gap-2 border-b bg-card px-2 py-1.5">
                  <LanguagePicker
                    value={q.hostAnswer.language}
                    disabled={!editable}
                    onChange={(language) => onChange({ hostAnswer: { ...q.hostAnswer!, language } })}
                  />
                  {editable && (
                    <Button variant="ghost" size="sm" className="ml-auto text-danger" onClick={() => onChange({ hostAnswer: null })}>
                      <Trash2 aria-hidden />
                      Remove
                    </Button>
                  )}
                </div>
                <SmallEditor
                  value={q.hostAnswer.code}
                  language={q.hostAnswer.language}
                  readOnly={!editable}
                  label="Your answer"
                  onChange={(code) => onChange({ hostAnswer: { ...q.hostAnswer!, code } })}
                />
              </div>
            ) : (
              editable && (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => onChange({ hostAnswer: { language: 'python', code: '' } })}
                >
                  <Plus aria-hidden />
                  Add your answer
                </Button>
              )
            )}
          </Field>

          <Field
            label={
              <>
                Explanation <span className="font-normal text-muted-foreground">(optional)</span>
              </>
            }
            hint="Shown to entrants after the end, as in quiz contests."
          >
            <Textarea value={q.explanation} maxLength={LIMITS.text} rows={2} onChange={(e) => onChange({ explanation: e.target.value })} />
          </Field>

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
