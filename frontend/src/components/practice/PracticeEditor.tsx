import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowDownToLine, Eye, FileCode2, Play, RotateCcw, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Kbd } from '@/components/ui/kbd'
import { RunStatusLine } from '@/components/code/bits'
import { STARTERS } from '@/components/code/starters'
import { useRunner } from '@/hooks/useRunner'
import { RUN_LIMITS } from '@/lib/sandbox/runner'
import { LANGUAGE_LABEL } from '@/lib/sandbox/types'
import type { CodeLanguage } from '@/lib/sandbox/types'
import { cn } from '@/lib/utils'

const CodeEditor = lazy(() => import('@/components/code/CodeEditor'))

// What a Run sends to the server for the AI, per field.
const RUN_SHARE_CHARS = 4_000

export interface PracticeRun {
  input: string
  output: string
  status: 'ok' | 'error' | 'timeout'
  ms: number
}

/** The code is kept on this device, per interview, in case of a reload. */
function useStored(key: string, initial: string) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, value)
      } catch {
        // Full or blocked storage only loses the draft on reload.
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [key, value])
  return [value, setValue] as const
}

/**
 * The candidate's editor in a practice interview. Code runs in this
 * browser; each Run is also shared with the AI, which sees it, and the
 * current code, with the next answer.
 */
export function PracticeEditor({
  interviewId,
  language,
  exampleInput,
  readOnly,
  onCode,
  onRun,
  className,
}: {
  interviewId: string
  language: CodeLanguage
  exampleInput?: string
  readOnly?: boolean
  onCode: (code: string) => void
  onRun: (run: PracticeRun) => void
  className?: string
}) {
  const [code, setCode] = useStored(`practice-code:${interviewId}`, STARTERS[language])
  const [input, setInput] = useState('')
  const { run, status, result, busy } = useRunner()

  useEffect(() => onCode(code), [code, onCode])
  // Start the input box from the question's example when it arrives.
  const [example, setExample] = useState<string | undefined>()
  if (exampleInput !== example) {
    setExample(exampleInput)
    if (exampleInput && !input) setInput(exampleInput)
  }

  const runNow = async () => {
    if (busy || readOnly) return
    const outcome = await run({
      language,
      code,
      stdin: input,
      limits: { timeMs: RUN_LIMITS.roomMs, memoryBytes: RUN_LIMITS.memoryBytes, outputBytes: RUN_LIMITS.outputBytes },
    })
    onRun({
      input: input.slice(0, RUN_SHARE_CHARS),
      output: `${outcome.stdout}${outcome.stderr}`.slice(0, RUN_SHARE_CHARS),
      status: outcome.verdict === 'ok' ? 'ok' : outcome.verdict === 'time' ? 'timeout' : 'error',
      ms: Math.round(outcome.ms),
    })
  }

  return (
    <section className={cn('flex flex-col overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium">
          <FileCode2 className="size-4" aria-hidden />
          {LANGUAGE_LABEL[language]}
        </span>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
          <Eye className="size-3.5 text-brand" aria-hidden />
          The AI sees your code and your last Run
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Reset to the starter code"
            title="Reset to the starter code"
            disabled={readOnly}
            onClick={() => setCode(STARTERS[language])}
          >
            <RotateCcw aria-hidden />
          </Button>
          <Button size="sm" onClick={() => void runNow()} disabled={busy || readOnly} title="Run (Ctrl+Enter)">
            <Play aria-hidden />
            Run
            <Kbd className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground lg:inline-flex">Ctrl ↵</Kbd>
          </Button>
        </span>
      </div>

      <div className="min-h-64 flex-1 overflow-auto">
        <Suspense fallback={<Skeleton className="m-3 h-48" />}>
          <CodeEditor value={code} language={language} readOnly={readOnly} onRun={() => void runNow()} onChange={setCode} className="h-full" />
        </Suspense>
      </div>

      <div className="grid border-t sm:grid-cols-2">
        <label className="grid border-b sm:border-r sm:border-b-0">
          <span className="flex h-9 items-center gap-2 px-3 text-xs font-medium text-muted-foreground">
            <ArrowDownToLine className="size-3.5" aria-hidden />
            Input
          </span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
