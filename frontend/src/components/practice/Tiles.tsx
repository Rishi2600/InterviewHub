import { Bot, Ear, Mic, MicOff, Volume2 } from 'lucide-react'
import { UserAvatar } from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'

export type AiState = 'writing' | 'speaking' | 'waiting'

/** Bars that rise and fall while someone is speaking or writing. */
export function LevelBars({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex h-3 items-center gap-0.5', className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="h-full w-0.5 animate-[level_0.9s_ease-in-out_infinite] rounded-full bg-primary"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  )
}

const STATE_LABEL: Record<AiState, string> = { writing: 'Writing…', speaking: 'Speaking', waiting: 'Waiting for your answer' }

function StatePill({ state }: { state: AiState }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
      {state === 'waiting' ? <Ear className="size-3.5" aria-hidden /> : state === 'speaking' ? <Volume2 className="size-3.5" aria-hidden /> : <LevelBars />}
      {STATE_LABEL[state]}
    </span>
  )
}

/** The interviewer's tile: the brand mark on a dark stage, never a face. */
export function AiTile({
  state,
  compact,
  className,
  name = 'AI interviewer',
}: {
  state: AiState
  compact?: boolean
  className?: string
  name?: string
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-[#0d1312]', className)}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 90% at 50% 30%, #14c8b433 0%, #0d1312 70%)' }} />
      {compact ? (
        <div className="relative flex h-full items-center gap-3 px-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Bot className="size-6" aria-hidden />
          </span>
          <span className="grid min-w-0 justify-items-start gap-1.5">
            <span className="text-sm font-medium text-white">{name}</span>
            <StatePill state={state} />
          </span>
        </div>
      ) : (
        <>
          <div className="relative grid h-full place-items-center p-4">
            <div className="grid justify-items-center gap-3">
              <span className={cn('grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground', state === 'speaking' && 'ring-4 ring-primary/40')}>
                <Bot className="size-8" aria-hidden />
              </span>
              <StatePill state={state} />
            </div>
          </div>
          <span className="absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">{name}</span>
        </>
      )}
    </div>
  )
}

/** The candidate's tile: no camera in practice, just who and the mic. */
export function YouTile({ name, listening, className }: { name: string; listening: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-[#0d1312]',
        listening && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        className,
      )}
    >
      <div className="grid h-full place-items-center p-4">
        <UserAvatar name={name} size="lg" />
      </div>
      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
        {listening ? <Mic className="size-3" aria-hidden /> : <MicOff className="size-3 text-red-400" aria-hidden />}
        {name} (you)
      </span>
    </div>
  )
}
