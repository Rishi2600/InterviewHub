import type { ReactNode } from 'react'
import { Check, ChevronDown, Shuffle } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CODE_LANGUAGES, LANGUAGE_LABEL } from '@/lib/sandbox/types'
import type { PracticeKind, PracticeMode } from '@/types'
import { cn } from '@/lib/utils'
import { KIND_LABEL, LEVELS, LEVEL_LABEL, MINUTES, MIXED, TOPICS } from './labels'
import { withChange } from './setup'
import type { Setup } from './setup'

/** A word in the sentence that opens its choices. */
function Pill({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-baseline gap-1 rounded-md px-1.5 text-brand underline decoration-primary decoration-2 underline-offset-[6px] outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-primary/10"
        >
          {label}
          <ChevronDown className="size-4 self-center opacity-60" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn('font-sans', wide ? 'w-[min(32rem,calc(100vw-2rem))] p-3' : 'w-44')}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Choices<T extends string | number>({
  value,
  options,
  label,
  onChange,
}: {
  value: T
  options: T[]
  label: (v: T) => string
  onChange: (v: T) => void
}) {
  return (
    <DropdownMenuRadioGroup value={String(value)} onValueChange={(v) => onChange(options.find((o) => String(o) === v) as T)}>
      {options.map((o) => (
        <DropdownMenuRadioItem key={String(o)} value={String(o)}>
          {label(o)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  )
}

function TopicChips({ setup, onChange }: { setup: Setup; onChange: (topic: string) => void }) {
  const chip = (topic: string, icon?: ReactNode) => {
    const on = setup.topic === topic
    return (
      <DropdownMenuItem
        key={topic}
        onSelect={() => onChange(topic)}
        className={cn(
          'h-8 rounded-full border px-3 text-sm',
          on ? 'border-primary bg-primary font-medium text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground' : '',
          topic === MIXED && !on && 'border-dashed',
        )}
      >
        {on ? <Check className="size-3.5" aria-hidden /> : icon}
        {topic}
      </DropdownMenuItem>
    )
  }
  return (
    <>
      <DropdownMenuLabel className="px-0 pt-0 text-xs font-medium text-muted-foreground">Topic</DropdownMenuLabel>
      <div className="flex flex-wrap gap-2">
        {TOPICS[setup.kind].map((t) => chip(t))}
        {chip(MIXED, <Shuffle className="size-3.5" aria-hidden />)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Mixed picks a topic at random.</p>
    </>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span className={cn('absolute top-0.5 size-3.5 rounded-full bg-card shadow transition-[left]', on ? 'left-[1.1rem]' : 'left-0.5')} />
    </button>
  )
}

/** "A technical interview on Python at mid level, for 30 minutes, by chat." */
export function SentenceSetup({ setup, onChange }: { setup: Setup; onChange: (s: Setup) => void }) {
  const change = (patch: Partial<Setup>) => onChange(withChange(setup, patch))
  const topic = setup.topic === MIXED ? 'mixed topics' : setup.topic
  return (
    <div className="grid gap-5">
      <p className="font-heading text-2xl leading-[1.7] font-semibold sm:text-3xl sm:leading-[1.7]">
        A{' '}
        <Pill label={KIND_LABEL[setup.kind].toLowerCase()}>
          <Choices value={setup.kind} options={['technical', 'behavioural'] as PracticeKind[]} label={(k) => KIND_LABEL[k]} onChange={(kind) => change({ kind })} />
        </Pill>{' '}
        interview on{' '}
        <Pill label={topic} wide>
          <TopicChips setup={setup} onChange={(t) => change({ topic: t })} />
        </Pill>{' '}
        at{' '}
        <Pill label={LEVEL_LABEL[setup.level].toLowerCase()}>
          <Choices value={setup.level} options={LEVELS} label={(l) => LEVEL_LABEL[l]} onChange={(level) => change({ level })} />
        </Pill>{' '}
        level, for{' '}
        <Pill label={`${setup.minutes} minutes`}>
          <Choices value={setup.minutes} options={MINUTES} label={(m) => `${m} minutes`} onChange={(minutes) => change({ minutes })} />
        </Pill>
        , by{' '}
        <Pill label={setup.mode}>
          <Choices value={setup.mode} options={['chat', 'voice'] as PracticeMode[]} label={(m) => (m === 'chat' ? 'Chat' : 'Voice')} onChange={(mode) => change({ mode })} />
        </Pill>
        .
      </p>
      {setup.kind === 'technical' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Switch on={setup.coding} onChange={(coding) => change({ coding })} label="Include a coding question" />
          <span>Include a coding question in</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!setup.coding}>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {LANGUAGE_LABEL[setup.language]}
                <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <Choices value={setup.language} options={[...CODE_LANGUAGES]} label={(l) => LANGUAGE_LABEL[l]} onChange={(language) => change({ language })} />
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-muted-foreground">· the AI sees your code and your last Run</span>
        </div>
      )}
    </div>
  )
}
