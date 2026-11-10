import { CircleAlert, CircleCheck, CircleDashed, EyeOff, FileCode2, Lightbulb } from 'lucide-react'
import { Panel, PromptText } from '@/components/contest/bits'
import { VerdictGrid, VerdictLegend } from '@/components/code/bits'
import { LANGUAGE_LABEL } from '@/lib/sandbox/types'
import { clock } from '@/lib/contest-time'
import type { CodeResultQuestion } from '@/types'

/** A code contest's questions after the end: how each hidden test went for
 *  the viewer, their submission that counted, and the host's explanation. */
export function CodeReview({
  questions,
  entered,
  host,
}: {
  questions: CodeResultQuestion[]
  entered: boolean
  host: boolean
}) {
  return (
    <Panel title={entered ? 'Your questions' : host ? 'Questions and how entrants did' : 'Questions'}>
      <ol>
        {questions.map((q) => (
          <Item key={q._id} q={q} entered={entered} />
        ))}
      </ol>
      <div className="grid gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
        {entered && <VerdictLegend />}
        <p className="flex gap-2">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Hidden tests stay hidden after the end, so the host can reuse the questions.
        </p>
      </div>
    </Panel>
  )
}

function Item({ q, entered }: { q: CodeResultQuestion; entered: boolean }) {
  const s = q.submission
  const status = !s
    ? { icon: CircleDashed, tone: 'text-muted-foreground', label: 'Not submitted' }
    : s.passed === s.total
      ? { icon: CircleCheck, tone: 'text-brand', label: 'All tests passed' }
      : { icon: CircleAlert, tone: 'text-danger', label: `${s.passed} of ${s.total} tests passed` }
  const Icon = status.icon
  return (
    <li className="grid gap-3 border-t p-5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {entered && (
          <>
            <Icon className={`size-4 ${status.tone}`} aria-hidden />
            <span className={`font-medium ${status.tone}`}>{status.label}</span>
          </>
        )}
        <span className="text-muted-foreground">
          Question {q.number} · {q.title}
        </span>
        <span className="ml-auto font-heading font-semibold tabular-nums">
          {entered ? q.earned : q.points}
          {entered && <span className="text-xs font-normal text-muted-foreground">/{q.points}</span>}
          {!entered && <span className="text-xs font-normal text-muted-foreground"> pts</span>}
        </span>
      </div>

      {!entered && <PromptText text={q.prompt} className="text-sm" />}
      {entered && s && <VerdictGrid verdicts={s.verdicts.map((v) => v.verdict)} />}
      {entered && !s && <p className="text-sm text-muted-foreground">No submission for this question.</p>}

      {s && (
        <details className="overflow-hidden rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
            <FileCode2 className="size-4 text-brand" aria-hidden />
            Your last submission
            <span className="text-xs text-muted-foreground">
              {LANGUAGE_LABEL[s.language]} · {clock(s.createdAt)}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">Show code</span>
          </summary>
          <pre className="max-h-96 overflow-auto border-t bg-muted/40 p-3 font-mono text-xs leading-relaxed">{s.code}</pre>
        </details>
      )}

      {q.answeredCount !== undefined && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {q.answeredCount} submitted · {q.correctCount ?? 0} passed every test
        </p>
      )}

      {q.explanation && (
        <div className="flex gap-2 rounded-lg bg-muted p-3 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <span className="text-muted-foreground">{q.explanation}</span>
        </div>
      )}
    </li>
  )
}
