// Small pieces shared by the room editor and the code contest pages.
import { ChevronDown, CircleCheck, CircleX, FileCode2, Loader2, Timer, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CODE_LANGUAGES, LANGUAGE_LABEL } from '@/lib/sandbox/types'
import type { CodeLanguage, RunResult, TestVerdict } from '@/lib/sandbox/types'
import type { RunStatus } from '@/hooks/useRunner'
import { VERDICT_LABEL } from '@/lib/sandbox/labels'
import { cn } from '@/lib/utils'

export function LanguagePicker({
  value,
  onChange,
  disabled,
}: {
  value: CodeLanguage
  onChange: (language: CodeLanguage) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileCode2 aria-hidden />
          {LANGUAGE_LABEL[value]}
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as CodeLanguage)}>
          {CODE_LANGUAGES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l}>
              {LANGUAGE_LABEL[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const RUN_LABEL: Record<RunResult['verdict'], string> = {
  ok: 'Finished',
  error: 'Error',
  time: 'Time limit',
  memory: 'Memory limit',
  output: 'Output limit',
}

/** "Finished · 41 ms", or why the run stopped. */
export function RunStatusLine({ status, result }: { status: RunStatus; result: RunResult | null }) {
  if (status === 'loading' || status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {status === 'loading' ? 'Loading the runtime…' : 'Running…'}
      </span>
    )
  }
  if (!result) return null
  const ok = result.verdict === 'ok'
  return (
    <span className={cn('inline-flex items-center gap-1', ok ? 'text-brand' : 'text-danger')}>
      {ok ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleX className="size-3.5" aria-hidden />}
      {RUN_LABEL[result.verdict]}
      {result.verdict !== 'time' && <span className="tnum">· {result.ms} ms</span>}
    </span>
  )
}


const VERDICT_ICON: Record<TestVerdict, typeof CircleCheck> = {
  passed: CircleCheck,
  wrong: CircleX,
  time: Timer,
  memory: TriangleAlert,
  output: TriangleAlert,
  error: TriangleAlert,
}

/** One square per hidden test: the verdict, never the test itself. */
export function VerdictGrid({ verdicts }: { verdicts: (TestVerdict | 'wait')[] }) {
  return (
    <ol className="grid max-w-md grid-cols-10 gap-1.5">
      {verdicts.map((v, i) => {
        const Icon = v === 'wait' ? Loader2 : VERDICT_ICON[v]
        const label = v === 'wait' ? 'Judging' : VERDICT_LABEL[v]
        return (
          <li
            key={i}
            title={`Test ${i + 1}: ${label}`}
            aria-label={`Test ${i + 1}: ${label}`}
            className={cn(
              'grid aspect-square place-items-center content-center gap-0.5 rounded-md',
              v === 'passed' ? 'bg-primary/15 text-brand' : v === 'wait' ? 'bg-muted text-muted-foreground' : 'bg-danger/10 text-danger',
            )}
          >
            <Icon className={cn('size-3.5', v === 'wait' && 'animate-spin')} aria-hidden />
            <span className="tnum text-[9px] leading-none font-semibold opacity-80">{i + 1}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function VerdictLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <CircleCheck className="size-3 text-brand" aria-hidden />
        Passed
      </span>
      <span className="inline-flex items-center gap-1">
        <CircleX className="size-3 text-danger" aria-hidden />
        Wrong answer
      </span>
      <span className="inline-flex items-center gap-1">
        <Timer className="size-3 text-danger" aria-hidden />
        Time limit
      </span>
      <span className="inline-flex items-center gap-1">
        <TriangleAlert className="size-3 text-danger" aria-hidden />
        Error or limit
      </span>
    </div>
  )
}
