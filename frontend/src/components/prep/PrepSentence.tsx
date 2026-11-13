import { useState } from 'react'
import { Check, Pencil } from 'lucide-react'
import { DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Choices, Pill } from '@/components/practice/SentenceSetup'
import { KIND_LABEL, LEVELS, LEVEL_LABEL, TOPICS } from '@/components/practice/labels'
import type { PracticeKind, PrepMode } from '@/types'
import { cn } from '@/lib/utils'
import { OWN_TOPIC_MAX } from './labels'
import { ownTopicProblem, withMode } from './choice'
import type { PrepChoice } from './choice'

function Chip({ topic, on, onSelect }: { topic: string; on: boolean; onSelect: () => void }) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn(
        'h-8 rounded-full border px-3 text-sm',
        on && 'border-primary bg-primary font-medium text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground',
      )}
    >
      {on && <Check className="size-3.5" aria-hidden />}
      {topic}
    </DropdownMenuItem>
  )
}

function OwnTopic({ choice, onChange }: { choice: PrepChoice; onChange: (c: PrepChoice) => void }) {
  const [text, setText] = useState(choice.own ? choice.topic : '')
  const [kind, setKind] = useState<PracticeKind>(choice.ownKind)
  const problem = text ? ownTopicProblem(text) : null
  const use = () => {
    if (!text || problem) return
    onChange({ ...choice, topic: text.trim().replace(/\s+/g, ' '), own: true, ownKind: kind })
  }
  return (
    <div className="mt-3 grid gap-2">
      <DropdownMenuLabel className="px-0 py-0 text-xs font-medium text-muted-foreground">Or your own topic</DropdownMenuLabel>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
          <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={text}
            maxLength={OWN_TOPIC_MAX}
            onChange={(e) => setText(e.target.value)}
            // Keep the menu from treating typing as item shortcuts.
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') use()
            }}
            placeholder="System design, Kubernetes…"
            aria-label="Your own topic"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {text.length}/{OWN_TOPIC_MAX}
          </span>
        </label>
        <span className="inline-flex rounded-lg bg-muted p-0.5 text-xs" role="radiogroup" aria-label="Its type">
          {(['technical', 'behavioural'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn('rounded-md px-2 py-1 font-medium', kind === k ? 'bg-card shadow-sm' : 'text-muted-foreground')}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </span>
        <DropdownMenuItem
          disabled={!text || !!problem}
          onSelect={use}
          className="h-8 justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground"
        >
          Use it
        </DropdownMenuItem>
      </div>
      <p className={cn('text-xs', problem ? 'text-danger' : 'text-muted-foreground')}>
        {problem ?? "Own topics are coach only, and don't count towards your recommendations."}
      </p>
    </div>
  )
}

/** "Drill me on SQL at junior level." / "Coach me on System design at mid level." */
export function PrepSentence({ choice, onChange }: { choice: PrepChoice; onChange: (c: PrepChoice) => void }) {
  const coach = choice.mode === 'coach'
  const pick = (topic: string) => onChange({ ...choice, topic, own: false })
  return (
    <p className="font-heading text-2xl leading-[1.7] font-semibold sm:text-3xl sm:leading-[1.7]">
      <Pill label={coach ? 'Coach' : 'Drill'}>
        <Choices
          value={choice.mode}
          options={['drill', 'coach'] as PrepMode[]}
          label={(m) => (m === 'drill' ? 'Drill: 10 quick questions' : 'Coach: a tutor that asks')}
          onChange={(mode) => onChange(withMode(choice, mode))}
        />
      </Pill>{' '}
      me on{' '}
      <Pill label={choice.topic} wide>
        <DropdownMenuLabel className="px-0 pt-0 text-xs font-medium text-muted-foreground">Technical</DropdownMenuLabel>
        <div className="flex flex-wrap gap-2">
          {TOPICS.technical.map((t) => (
            <Chip key={t} topic={t} on={!choice.own && choice.topic === t} onSelect={() => pick(t)} />
          ))}
        </div>
        {coach ? (
          <>
            <DropdownMenuLabel className="mt-3 px-0 text-xs font-medium text-muted-foreground">Behavioural</DropdownMenuLabel>
            <div className="flex flex-wrap gap-2">
              {TOPICS.behavioural.map((t) => (
                <Chip key={t} topic={t} on={!choice.own && choice.topic === t} onSelect={() => pick(t)} />
              ))}
            </div>
            <OwnTopic choice={choice} onChange={onChange} />
          </>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Drills draw on a shared question bank, so they cover these topics. Want something else? Switch to Coach.
          </p>
        )}
      </Pill>{' '}
      at{' '}
      <Pill label={LEVEL_LABEL[choice.level].toLowerCase()}>
        <Choices value={choice.level} options={LEVELS} label={(l) => LEVEL_LABEL[l]} onChange={(level) => onChange({ ...choice, level })} />
      </Pill>{' '}
      level.
    </p>
  )
}
