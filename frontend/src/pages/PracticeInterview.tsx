import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bot,
  Check,
  Code2,
  Keyboard,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  RefreshCw,
  Square,
  Timer,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { ErrorState } from '@/components/common/States'
import { ConnectionStatus } from '@/components/chat/ConnectionStatus'
import { Conversation, InlineText } from '@/components/practice/Conversation'
import { PracticeComposer } from '@/components/practice/PracticeComposer'
import { PracticeEditor } from '@/components/practice/PracticeEditor'
import { AiTile, YouTile } from '@/components/practice/Tiles'
import { VoicePanel } from '@/components/practice/VoicePanel'
import type { AiState } from '@/components/practice/Tiles'
import { KIND_LABEL, practiceTitle } from '@/components/practice/labels'
import { useAuth } from '@/hooks/useAuth'
import { useNow } from '@/hooks/useNow'
import { usePracticeSocket } from '@/hooks/usePracticeSocket'
import { useVoice, voiceSupport } from '@/hooks/useVoice'
import { errorMessage } from '@/lib/api'
import { endPractice, getPractice } from '@/lib/endpoints'
import type { CodingQuestion, PracticeInterview as Interview } from '@/types'
import { cn } from '@/lib/utils'

/**
 * A practice interview, laid out like a room: the AI and you as tiles, the
 * work on the left, the conversation on the right. Once it ends, it waits
 * here for the feedback.
 */
export function PracticeInterview() {
  const { id = '' } = useParams<{ id: string }>()
  const query = useQuery({ queryKey: ['practice', id], queryFn: () => getPractice(id), enabled: Boolean(id) })
  const [sawLive, setSawLive] = useState(false)
  if (query.data?.status === 'active' && !sawLive) setSawLive(true)

  if (query.isLoading) return <FullPageLoader label="Opening the interview…" />
  if (query.isError || !query.data) {
    return (
      <div className="grid min-h-svh place-items-center p-4">
        <ErrorState title="Couldn't load this interview" message={errorMessage(query.error, 'It may have been deleted.')} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  const iv = query.data
  // Opened after it finished: straight to the feedback. Ended while here:
  // the ending screen stays, with its "View feedback" button.
  if ((iv.status === 'done' || iv.status === 'failed') && !sawLive) return <Navigate to={`/practice/${iv.id}/feedback`} replace />
  if (iv.status !== 'active') return <EndingScreen interview={iv} />
  return <InterviewScreen interview={iv} />
}

function InterviewScreen({ interview }: { interview: Interview }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const live = usePracticeSocket(interview)
  const [endOpen, setEndOpen] = useState(false)
  const [tab, setTab] = useState<'chat' | 'question'>('chat')
  const code = useRef('')
  const onCode = useCallback((c: string) => {
    code.current = c
  }, [])

  const end = useMutation({
    mutationFn: () => endPractice(interview.id),
    onSuccess: (iv) => queryClient.setQueryData(['practice', interview.id], iv),
    onError: (err) => toast.error(errorMessage(err, "Couldn't end the interview")),
  })

  // Ended by the AI, the answer limit or the clock: show the ending screen.
  useEffect(() => {
    if (live.ended) void queryClient.invalidateQueries({ queryKey: ['practice', interview.id] })
  }, [live.ended, queryClient, interview.id])

  // Time's up: end it here rather than wait for the server's sweep.
  const now = useNow(1000)
  const msLeft = new Date(interview.endsAt).getTime() - now
  const timeUp = msLeft <= 0
  const ending = useRef(false)
  useEffect(() => {
    if (timeUp && !ending.current) {
      ending.current = true
      end.mutate()
    }
  }, [timeUp, end])

  const answers = live.turns.filter((t) => t.kind === 'candidate').length
  const question = live.question
  const coding = Boolean(interview.language && question)
  const lastAi = [...live.turns].reverse().find((t) => t.kind === 'ai')
  const canAnswer = live.status === 'connected' && !live.waiting && live.turns.length > 0 && !timeUp
  const send = (text: string) => live.answer(text, interview.language ? code.current : undefined)

  // Voice: the browser listens and sends after a pause, and reads replies aloud.
  const support = voiceSupport()
  const [mode, setMode] = useState<'chat' | 'voice'>(interview.mode === 'voice' && support.listen ? 'voice' : 'chat')
  const [speaker, setSpeaker] = useState(true)
  const voice = useVoice({ on: mode === 'voice', paused: !canAnswer, onAnswer: send })
  const { speak, stopSpeaking } = voice
  const spoken = useRef(live.turns.length)
  useEffect(() => {
    const latest = live.turns[live.turns.length - 1]
    if (live.turns.length > spoken.current && latest?.kind === 'ai' && mode === 'voice' && speaker) speak(latest.text)
    spoken.current = live.turns.length
  }, [live.turns, mode, speaker, speak])
  const switchMode = () => {
    stopSpeaking()
    setMode((m) => (m === 'voice' ? 'chat' : 'voice'))
  }
  const aiState: AiState = voice.speaking ? 'speaking' : live.waiting ? 'writing' : 'waiting'

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/practice" aria-label="Back to AI practice">
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate font-heading text-base font-semibold">{practiceTitle(interview)}</h1>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-brand">
            <Bot className="size-3" aria-hidden />
            Practice
          </span>
          <span className="hidden items-center gap-3 sm:inline-flex">
            <span className={cn('tnum inline-flex items-center gap-1 text-sm', msLeft < 120_000 ? 'text-danger' : 'text-muted-foreground')}>
              <Timer className="size-3.5" aria-hidden />
              {clock(msLeft)} left
            </span>
            <span className="tnum inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MessageSquare className="size-3.5" aria-hidden />
              {answers} / {interview.maxAnswers}
            </span>
            {live.status !== 'connected' && <ConnectionStatus status={live.status} />}
          </span>
        </div>
        {support.listen && (
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={switchMode}>
            {mode === 'voice' ? <Keyboard aria-hidden /> : <AudioLines aria-hidden />}
            {mode === 'voice' ? 'Switch to typing' : 'Switch to voice'}
          </Button>
        )}
        <Button variant="outline" size="sm" className="border-danger/40 text-danger hover:bg-danger/10" onClick={() => setEndOpen(true)} disabled={end.isPending}>
          <Square aria-hidden />
          <span className="hidden sm:inline">End interview</span>
          <span className="sm:hidden">End</span>
        </Button>
      </header>

      <div className="grid items-start gap-3 p-3 pb-24 sm:p-4 sm:pb-24 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-3">
          {coding ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <AiTile state={aiState} compact className="h-24" />
                <YouTile name={user?.username ?? 'You'} listening={voice.listening} className="h-24" />
              </div>
              <PracticeEditor
                interviewId={interview.id}
                language={interview.language!}
                exampleInput={question?.exampleInput}
                onCode={onCode}
                onRun={live.recordRun}
                className="lg:h-[calc(100svh-13rem)] lg:min-h-[26rem]"
              />
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <AiTile state={aiState} className="aspect-video" />
                <YouTile name={user?.username ?? 'You'} listening={voice.listening} className="aspect-video sm:aspect-auto" />
              </div>
              {live.failure ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">{live.failure}</span>
                  <Button size="sm" variant="outline" onClick={live.retryStart}>
                    <RefreshCw aria-hidden />
                    Try again
                  </Button>
                </div>
              ) : (
                <section className="rounded-xl border bg-card px-4 py-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Latest question</div>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {lastAi ? <InlineText text={lastAi.text} /> : <span className="text-muted-foreground">The interviewer is getting ready…</span>}
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        <section className="flex h-[30rem] flex-col overflow-hidden rounded-xl border bg-card lg:sticky lg:top-[4.5rem] lg:h-[calc(100svh-5.5rem)]">
          <div role="tablist" className="flex border-b px-2 text-sm">
            {(coding ? (['chat', 'question'] as const) : (['chat'] as const)).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5',
                  tab === t ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'chat' ? 'Conversation' : 'Question'}
              </button>
            ))}
          </div>
          {tab === 'question' && question ? (
            <QuestionPanel question={question} />
          ) : (
            <>
              <Conversation turns={live.turns} draft={live.draft} waiting={live.waiting} />
              <div className="border-t p-2.5">
                {mode === 'voice' ? (
                  <VoicePanel
                    text={voice.text}
                    listening={voice.listening}
                    speaking={voice.speaking}
                    waiting={live.waiting}
                    error={voice.error}
                    onSendNow={voice.sendNow}
                    onStopSpeaking={stopSpeaking}
                    onType={switchMode}
                  />
                ) : (
                  <PracticeComposer
                    onSend={send}
                    disabled={!canAnswer}
                    disabledReason={live.waiting ? 'The interviewer is writing…' : live.status !== 'connected' ? 'Reconnecting…' : undefined}
                    restore={live.retracted}
                    extra={
                      support.listen && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={switchMode}>
                          <Mic aria-hidden />
                          Use voice
                        </Button>
                      )
                    }
                  />
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {(support.listen || support.speak) && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card p-1.5 shadow-sm">
          {support.listen && (
            <button
              type="button"
              onClick={switchMode}
              aria-label={mode === 'voice' ? 'Switch to typing' : 'Answer by voice'}
              title={mode === 'voice' ? 'Switch to typing' : 'Answer by voice'}
              className={cn(
                'grid size-9 place-items-center rounded-full border',
                mode === 'voice' ? 'bg-card hover:bg-muted' : 'border-danger/40 bg-danger/10 text-danger',
              )}
            >
              {mode === 'voice' ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (speaker) stopSpeaking()
              setSpeaker((s) => !s)
            }}
            aria-label={speaker ? "Mute the interviewer's voice" : "Hear the interviewer's voice"}
            title={speaker ? "Mute the interviewer's voice" : "Hear the interviewer's voice"}
            className="grid size-9 place-items-center rounded-full border bg-card hover:bg-muted"
          >
            {speaker && mode === 'voice' ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setEndOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#dc2626] px-3 text-sm font-medium text-white hover:bg-[#b91c1c]"
          >
            <Square className="size-4" aria-hidden />
            End
          </button>
        </div>
      )}

      <AlertDialog open={endOpen} onOpenChange={setEndOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the interview now?</AlertDialogTitle>
            <AlertDialogDescription>
              {answers
                ? 'Your feedback is written from what you have answered so far. The chat is deleted once it is ready.'
                : "You haven't answered anything yet, so there's no feedback and it won't count toward this month."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => end.mutate()}>
              End interview
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** "12:05", or "0:00" once time is up. */
function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function QuestionPanel({ question }: { question: CodingQuestion }) {
  return (
    <div className="grid content-start gap-3 overflow-y-auto p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-6 place-items-center rounded-md bg-primary/15 text-brand">
          <Code2 className="size-3.5" aria-hidden />
        </span>
        {question.title}
      </h2>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        <InlineText text={question.statement} />
      </p>
      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="rounded-md bg-muted px-2.5 py-2">
          <div className="mb-1 font-sans text-[11px] font-medium text-muted-foreground">Example input</div>
          <pre className="whitespace-pre-wrap">{question.exampleInput}</pre>
        </div>
        <div className="rounded-md bg-muted px-2.5 py-2">
          <div className="mb-1 font-sans text-[11px] font-medium text-muted-foreground">Example output</div>
          <pre className="whitespace-pre-wrap">{question.exampleOutput}</pre>
        </div>
      </div>
    </div>
  )
}

/** After the end: the feedback being written, or why there is none. */
function EndingScreen({ interview }: { interview: Interview }) {
  // Check back until the feedback is in.
  const query = useQuery({
    queryKey: ['practice', interview.id],
    queryFn: () => getPractice(interview.id),
    initialData: interview,
    refetchInterval: (q) => (q.state.data?.status === 'ended' ? 4_000 : false),
  })
  const iv = query.data ?? interview
  const cancelled = iv.status === 'cancelled'
  const done = iv.status === 'done'
  const failed = iv.status === 'failed'
  const minutes = iv.endedAt ? Math.max(1, Math.round((new Date(iv.endedAt).getTime() - new Date(iv.startedAt).getTime()) / 60_000)) : iv.minutes

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8">
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">{cancelled ? 'Interview cancelled' : "That's the interview done"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {practiceTitle(iv)} · {KIND_LABEL[iv.kind]}
        </p>
        {cancelled ? (
          <p className="mt-5 text-sm leading-relaxed">
            You ended it before answering, so there's no feedback, and it doesn't count toward this month's interviews.
          </p>
        ) : (
          <ol className="mt-6 grid gap-4">
            <Step state="done" title="Interview ended" detail={`${minutes} min · ${iv.answers} ${iv.answers === 1 ? 'answer' : 'answers'}`} />
            <Step
              state={done ? 'done' : failed ? 'failed' : 'now'}
              title={done ? 'Feedback written' : failed ? "The feedback couldn't be written" : 'Writing your feedback'}
              detail={done ? 'Ready to read' : failed ? 'The AI service was busy for too long.' : 'Usually about 20 seconds. You can leave this page.'}
            />
            <Step state={done || failed ? 'done' : 'next'} title="Chat deleted" detail="Only the feedback is kept" />
          </ol>
        )}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          {done ? (
            <Button asChild>
              <Link to={`/practice/${iv.id}/feedback`}>
                View feedback
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link to="/practice">
                <ArrowLeft aria-hidden />
                Back to AI practice
              </Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

function Step({ state, title, detail }: { state: 'done' | 'now' | 'next' | 'failed'; title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full',
          state === 'done' && 'bg-primary text-primary-foreground',
          state === 'now' && 'border-2 border-primary text-brand',
          state === 'next' && 'border',
          state === 'failed' && 'bg-danger/15 text-danger',
        )}
      >
        {state === 'done' && <Check className="size-3.5" aria-hidden />}
        {state === 'now' && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        {state === 'failed' && <X className="size-3.5" aria-hidden />}
      </span>
      <span>
        <span className={cn('block text-sm font-medium', state === 'next' && 'text-muted-foreground')}>{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </li>
  )
}
