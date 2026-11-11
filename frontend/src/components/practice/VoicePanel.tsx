import { Keyboard, Mic, MicOff, SendHorizontal, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LevelBars } from './Tiles'

/**
 * Where a voice answer takes shape: what the browser heard so far, sent
 * after a pause or with "Send now". Typing is always one click away.
 */
export function VoicePanel({
  text,
  listening,
  speaking,
  waiting,
  error,
  onSendNow,
  onStopSpeaking,
  onType,
}: {
  text: string
  listening: boolean
  speaking: boolean
  waiting: boolean
  error: string | null
  onSendNow: () => void
  onStopSpeaking: () => void
  onType: () => void
}) {
  const typeButton = (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onType}>
      <Keyboard aria-hidden />
      Type instead
    </Button>
  )
  if (error) {
    return (
      <div className="grid gap-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">
        <span className="flex items-start gap-2">
          <MicOff className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          {error}
        </span>
        <span>{typeButton}</span>
      </div>
    )
  }
  const status = speaking ? 'The interviewer is speaking' : waiting ? 'The interviewer is writing…' : listening ? 'Listening' : 'Starting the microphone…'
  return (
    <div className={cn('rounded-xl bg-card', listening && 'shadow-sm')}>
      <div className="rounded-xl border border-primary/50 bg-primary/[0.06] p-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'relative grid size-11 shrink-0 place-items-center rounded-full',
              listening ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
            aria-hidden
          >
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />}
            <Mic className="relative size-5" />
          </span>
          <div className="min-w-0 flex-1" aria-live="polite">
            <div className="flex items-center gap-2 text-xs font-medium text-brand">
              {(listening || speaking) && <LevelBars />}
              {status}
            </div>
            <p className="mt-1 min-h-5 text-sm leading-relaxed break-words">
              {text || (listening ? <span className="text-muted-foreground">Start speaking when you're ready.</span> : null)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{speaking ? 'Your turn comes when it finishes.' : 'Sends after a 2-second pause'}</span>
          <span className="ml-auto flex gap-1.5">
            {typeButton}
            {speaking ? (
              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onStopSpeaking}>
                <Square aria-hidden />
                Stop speaking
              </Button>
            ) : (
              <Button size="sm" className="h-7 px-2.5 text-xs" onClick={onSendNow} disabled={!text}>
                <SendHorizontal aria-hidden />
                Send now
              </Button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

