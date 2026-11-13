import { Check } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { KIND_LABEL, REVIEW_AREAS, TOPICS } from '@/components/practice/labels'
import { cn } from '@/lib/utils'
import type { PracticeKind } from '@/types'
import { MAX_TOPICS, NOTE_CHARS } from './draft'
import type { ReviewDraft } from './draft'

/** The review form: type, topics, 1 to 5 per area, a note. */
export function ReviewForm({
  draft,
  onChange,
  disabled,
}: {
  draft: ReviewDraft
  onChange: (d: ReviewDraft) => void
  disabled?: boolean
}) {
  const setKind = (kind: PracticeKind) => {
    if (kind === draft.kind) return
    // Topics and areas belong to a type.
    onChange({ ...draft, kind, topics: [], scores: {} })
  }
  const toggleTopic = (t: string) => {
    const on = draft.topics.includes(t)
    if (!on && draft.topics.length >= MAX_TOPICS) return
    onChange({ ...draft, topics: on ? draft.topics.filter((x) => x !== t) : [...draft.topics, t] })
  }
  const setScore = (area: string, score: number | null) => {
    const scores = { ...draft.scores }
    if (score === null) delete scores[area]
    else scores[area] = score
    onChange({ ...draft, scores })
  }

  return (
    <fieldset disabled={disabled} className="grid gap-5 disabled:opacity-70">
      <div>
        <div className="mb-2 text-sm font-medium">Type</div>
        <span className="inline-flex rounded-lg bg-muted p-0.5 text-sm" role="radiogroup" aria-label="Type">
          {(['technical', 'behavioural'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={draft.kind === k}
              onClick={() => setKind(k)}
              className={cn(
                'rounded-md px-3 py-1.5 font-medium',
                draft.kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </span>
      </div>

      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-sm font-medium">Topics</span>
          <span className="text-xs text-muted-foreground">
            1 to {MAX_TOPICS} · {draft.topics.length} picked
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TOPICS[draft.kind].map((t) => {
            const on = draft.topics.includes(t)
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTopic(t)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm',
                  on ? 'border-primary bg-primary font-medium text-primary-foreground' : 'bg-card hover:bg-muted',
                )}
              >
                {on && <Check className="size-3.5" aria-hidden />}
                {t}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">How they did</span>
          <span className="text-xs text-muted-foreground">1 weak · 3 fine · 5 strong. Skip what you didn't see.</span>
        </div>
        <div className="grid gap-2">
          {REVIEW_AREAS[draft.kind].map((area) => {
            const value = draft.scores[area] ?? null
            const cell = (score: number | null, label: string) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={value === score}
                aria-label={score === null ? `${area}: not seen` : `${area}: ${score} out of 5`}
                onClick={() => setScore(area, score)}
                className={cn(
                  'h-8 min-w-8 rounded-md px-2 text-sm font-medium tabular-nums',
                  value === score ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground',
                )}
              >
                {label}
              </button>
            )
            return (
              <div key={area} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">{area}</span>
                <span className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label={area}>
                  {[1, 2, 3, 4, 5].map((n) => cell(n, String(n)))}
                  <span className="mx-0.5 my-1.5 w-px bg-border" />
                  {cell(null, 'Not seen')}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <label htmlFor="review-note" className="text-sm font-medium">
            Note <span className="font-normal text-muted-foreground">optional</span>
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {draft.note.length} / {NOTE_CHARS.toLocaleString('en-GB')}
          </span>
        </div>
        <Textarea
          id="review-note"
          rows={3}
          maxLength={NOTE_CHARS}
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder="What went well, and what to practise next."
        />
      </div>
    </fieldset>
  )
}
