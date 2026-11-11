import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowDownToLine, Play, RotateCcw, ShieldCheck, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Kbd } from '@/components/ui/kbd'
import { LanguagePicker, RunStatusLine } from './bits'
import { useRunner } from '@/hooks/useRunner'
import { RUN_LIMITS } from '@/lib/sandbox/runner'
import type { CodeLanguage } from '@/lib/sandbox/types'
import { cn } from '@/lib/utils'
import { STARTERS } from './starters'

const CodeEditor = lazy(() => import('./CodeEditor'))


interface Draft {
  language: CodeLanguage
  code: Partial<Record<CodeLanguage, string>>
  input: string
}

/** The candidate's code is kept on this device only, per room. */
function useDraft(roomId: string) {
  const key = `room-draft:${roomId}`
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved) return JSON.parse(saved) as Draft
    } catch {
      // Storage off or unreadable: start fresh.
    }
    return { language: 'python', code: {}, input: '' }
  })
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(draft))
      } catch {
        // Full or blocked storage only loses the draft on reload.
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [key, draft])
  return [draft, setDraft] as const
}

/**
 * The candidate's editor in a room. Nothing here is sent to the server:
 * code runs in this browser, and the interviewers see it by screen share.
 */
export function RoomEditor({ roomId, readOnly, className }: { roomId: string; readOnly?: boolean; className?: string }) {
  const [draft, setDraft] = useDraft(roomId)
  const { run, status, result, busy } = useRunner()
  const code = draft.code[draft.language] ?? STARTERS[draft.language]

  const runNow = () => {
    if (busy) return
    void run({
      language: draft.language,
      code,
      stdin: draft.input,
      limits: { timeMs: RUN_LIMITS.roomMs, memoryBytes: RUN_LIMITS.memoryBytes, outputBytes: RUN_LIMITS.outputBytes },
    })
  }

  return (
    <section className={cn('flex flex-col overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <LanguagePicker value={draft.language} onChange={(language) => setDraft((d) => ({ ...d, language }))} disabled={readOnly} />
        <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
          <ShieldCheck className="size-3.5 text-brand" aria-hidden />
          Runs in your browser · 5 s · 256 MB
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Reset to the starter code"
            title="Reset to the starter code"
            disabled={readOnly}
            onClick={() => setDraft((d) => ({ ...d, code: { ...d.code, [d.language]: STARTERS[d.language] } }))}
          >
            <RotateCcw aria-hidden />
          </Button>
          <Button size="sm" onClick={runNow} disabled={busy} title="Run (Ctrl+Enter)">
            <Play aria-hidden />
            Run
            <Kbd className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground lg:inline-flex">Ctrl ↵</Kbd>
          </Button>
        </span>
      </div>

      <div className="min-h-64 flex-1 overflow-auto">
        <Suspense fallback={<Skeleton className="m-3 h-48" />}>
          <CodeEditor
            value={code}
            language={draft.language}
            readOnly={readOnly}
            onRun={runNow}
            onChange={(next) => setDraft((d) => ({ ...d, code: { ...d.code, [d.language]: next } }))}
            className="h-full"
          />
        </Suspense>
      </div>

      <div className="grid border-t sm:grid-cols-2">
        <label className="grid border-b sm:border-r sm:border-b-0">
          <span className="flex h-9 items-center gap-2 px-3 text-xs font-medium text-muted-foreground">
            <ArrowDownToLine className="size-3.5" aria-hidden />
            Input
          </span>
          <textarea
            value={draft.input}
            onChange={(e) => setDraft((d) => ({ ...d, input: e.target.value }))}
            placeholder="What the program reads from stdin"
            spellCheck={false}
            className="min-h-20 resize-y bg-transparent px-3 pb-3 font-mono text-xs outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="grid content-start" aria-live="polite">
          <div className="flex h-9 items-center gap-2 px-3 text-xs font-medium text-muted-foreground">
            <SquareTerminal className="size-3.5" aria-hidden />
            Output
            <span className="ml-auto">
              <RunStatusLine status={status} result={result} />
            </span>
          </div>
          <pre className="max-h-48 min-h-20 overflow-auto px-3 pb-3 font-mono text-xs whitespace-pre-wrap">
            {result?.stdout}
            {result?.stderr && <span className="text-danger">{result.stderr}</span>}
          </pre>
        </div>
      </div>
    </section>
  )
}
