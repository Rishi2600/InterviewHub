import { Fragment } from 'react'
import { Bot, Play } from 'lucide-react'
import type { PracticeTurn } from '@/types'
import { cn } from '@/lib/utils'

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** The AI's text with `code` and **bold**, the only formatting it uses. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part, i) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
          <code key={i} className="rounded bg-background/60 px-1 font-mono text-[0.85em]">
            {part.slice(1, -1)}
          </code>
        ) : part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export function AiMark({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground', className)}>
      <Bot className="size-4" aria-hidden />
    </span>
  )
}

function Caret() {
  return <span className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-[0.18em] animate-pulse bg-primary" aria-hidden />
}

function AiBubble({ text, at, writing }: { text: string; at?: string; writing?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <AiMark />
      <div className="max-w-[88%] min-w-0">
        <div className="mb-1 flex items-baseline gap-1.5 text-xs">
          <span className="font-medium">AI interviewer</span>
          <span className="text-muted-foreground">{writing ? 'writing…' : at && time(at)}</span>
        </div>
        <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
          {text ? <InlineText text={text} /> : <span className="text-muted-foreground">Thinking</span>}
          {writing && <Caret />}
        </div>
      </div>
    </div>
  )
}

function RunLine({ turn }: { turn: PracticeTurn }) {
  const run = turn.run
  if (!run) return null
  const result = run.status === 'ok' ? `${run.ms} ms` : run.status === 'timeout' ? 'took too long' : 'error'
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <Play className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
      <span className="min-w-0 flex-1">
        You ran your code ({result}). The AI sees it with your next message.
        {run.input && (
          <span className="mt-1 block truncate font-mono">
            {run.input.split('\n')[0]} → {run.output.split('\n')[0] || '(no output)'}
          </span>
        )}
      </span>
      <span className="tnum">{time(turn.at)}</span>
    </div>
  )
}

/** The conversation, newest at the bottom, with the reply being written. */
export function Conversation({ turns, draft, waiting }: { turns: PracticeTurn[]; draft: string; waiting: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto" aria-live="polite">
      <div className="grid gap-4 p-3">
        {turns.map((t, i) =>
          t.kind === 'ai' ? (
            <AiBubble key={i} text={t.text} at={t.at} />
          ) : t.kind === 'run' ? (
            <RunLine key={i} turn={t} />
          ) : (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-primary-foreground">
                {t.text}
                <div className="mt-0.5 text-right text-[10px] opacity-70">{time(t.at)}</div>
              </div>
            </div>
          ),
        )}
        {waiting && <AiBubble text={draft} writing />}
      </div>
    </div>
  )
}
