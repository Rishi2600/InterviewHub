import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronDown,
  ClipboardPen,
  Copy,
  Ellipsis,
  Link2,
  Maximize2,
  MonitorOff,
  Pencil,
  Pin,
  PinOff,
  Play,
  ScreenShare,
  Square,
  Video,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ErrorState } from '@/components/common/States'
import { Composer } from '@/components/chat/Composer'
import { ConnectionStatus } from '@/components/chat/ConnectionStatus'
import { MessageList } from '@/components/chat/MessageList'
import { ParticipantsList } from '@/components/chat/ParticipantsList'
import { PinDialog } from '@/components/chat/PinDialog'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { CallBar } from '@/components/call/CallBar'
import { StreamVideo, VideoTile } from '@/components/call/VideoTile'
import { RoomEditor } from '@/components/code/RoomEditor'
import { LiveDot } from '@/components/common/LiveDot'
import { useAuth } from '@/hooks/useAuth'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useCall } from '@/hooks/useCall'
import type { CallPeer } from '@/hooks/useCall'
import { useCopy } from '@/hooks/useCopy'
import { getRoom, setRoomState } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Room as RoomType, RoomState } from '@/types'

const STATE_TOAST: Record<RoomState, string> = {
  waiting: 'Room is waiting',
  active: 'Room started',
  ended: 'Room ended',
}

/**
 * An interview room, "call first": video across the top, then the work, with
 * chat beside it and the call controls floating at the bottom. Candidates get
 * a code editor that only they see; interviewers watch it by screen share.
 */
export function Room() {
  const { id = '' } = useParams<{ id: string }>()
  const roomQuery = useQuery({ queryKey: ['room', id], queryFn: () => getRoom(id), enabled: Boolean(id) })

  if (roomQuery.isLoading) return <FullPageLoader label="Opening the room…" />
  if (roomQuery.isError || !roomQuery.data) {
    return (
      <div className="grid min-h-svh place-items-center p-4">
        <ErrorState
          title="Couldn't load this room"
          message={errorMessage(roomQuery.error, 'The room may not exist, or you may not have access.')}
          onRetry={() => void roomQuery.refetch()}
        />
      </div>
    )
  }
  return <RoomScreen room={roomQuery.data} />
}

function RoomScreen({ room }: { room: RoomType }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const copy = useCopy()
  const [pinOpen, setPinOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [tab, setTab] = useState<'chat' | 'question' | 'people'>('chat')

  const canControl = Boolean(user && (room.ownerId === user.id || user.role === 'admin'))
  // The editor is for candidates; everyone else watches their screen.
  const isCandidate = user?.role === 'candidate'
  const chat = useChatSocket(room._id)
  const isEnded = room.state === 'ended' || chat.ended
  const call = useCall({ socket: chat.socket, roomId: room._id, inRoom: chat.inRoom, ended: isEnded })

  // Seed the pinned question from the room document, then let the socket own it.
  useEffect(() => {
    chat.setPinnedQuestion(room.pinnedQuestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room._id])

  // Ended by the owner while we were here.
  useEffect(() => {
    if (!chat.ended) return
    queryClient.setQueryData<RoomType>(['room', room._id], (r) => (r ? { ...r, state: 'ended' } : r))
    toast.info('The room has ended.')
  }, [chat.ended, queryClient, room._id])

  const stateMutation = useMutation({
    mutationFn: (state: RoomState) => setRoomState(room._id, state),
    onSuccess: (updated) => {
      queryClient.setQueryData(['room', room._id], updated)
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success(STATE_TOAST[updated.state])
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not change the room')),
  })

  const tabs = [
    { key: 'chat' as const, label: 'Chat' },
    ...(isCandidate ? [] : [{ key: 'question' as const, label: 'Question' }]),
    { key: 'people' as const, label: 'People', count: room.participants.length },
  ]

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/" aria-label="Back to the dashboard">
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate font-heading text-base font-semibold">{room.title}</h1>
          <StatusBadge state={isEnded ? 'ended' : room.state} />
          <span className="hidden sm:inline-flex">
            <ConnectionStatus status={chat.status} />
          </span>
        </div>
        <span className="hidden h-8 items-center gap-1 rounded-md border pr-1 pl-2.5 font-mono text-xs tracking-[0.16em] md:flex">
          {room.code}
          <Button variant="ghost" size="icon-sm" className="size-6" aria-label="Copy join code" onClick={() => copy(room.code, 'Join code copied')}>
            <Copy aria-hidden />
          </Button>
        </span>
        {canControl && room.state === 'waiting' && !isEnded && (
          <Button size="sm" onClick={() => stateMutation.mutate('active')} disabled={stateMutation.isPending}>
            <Play aria-hidden />
            Start
          </Button>
        )}
        {canControl && !isEnded && (
          <Button variant="outline" size="sm" className="hidden border-danger/40 text-danger hover:bg-danger/10 sm:inline-flex" onClick={() => setEndOpen(true)}>
            <Square aria-hidden />
            End room
          </Button>
        )}
        {isEnded && (
          <Button size="sm" asChild>
            <Link to={`/rooms/${room._id}/review`}>
              <ClipboardPen aria-hidden />
              {isCandidate ? 'Your review' : 'Review candidates'}
            </Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Room</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => copy(room.code, 'Join code copied')}>
              <Copy aria-hidden />
              Copy join code
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => copy(window.location.href, 'Room link copied')}>
              <Link2 aria-hidden />
              Copy room link
            </DropdownMenuItem>
            {canControl && !isEnded && (
              <>
                <DropdownMenuItem onSelect={() => setPinOpen(true)}>
                  <Pin aria-hidden />
                  {chat.pinnedQuestion ? 'Edit question' : 'Pin a question'}
                </DropdownMenuItem>
                {chat.pinnedQuestion && (
                  <DropdownMenuItem onSelect={chat.unpinQuestion}>
                    <PinOff aria-hidden />
                    Unpin question
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setEndOpen(true)}>
                  <Square aria-hidden />
                  End room
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="p-3 pb-28 sm:p-4 sm:pb-28">
        <VideoStrip call={call} name={user?.username ?? 'You'} ended={isEnded} />

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {isCandidate ? (
            <div className="grid gap-3">
              {!isEnded && <ShareStrip joined={call.joined} sharing={!!call.local.screen} onShare={call.startShare} onStop={call.stopShare} />}
              {chat.pinnedQuestion && <QuestionStrip question={chat.pinnedQuestion} />}
              <RoomEditor roomId={room._id} readOnly={isEnded} className="lg:h-[calc(100svh-19rem)] lg:min-h-[30rem]" />
            </div>
          ) : (
            <Stage joined={call.joined} peers={call.peers} participants={room.participants.filter((p) => p.role === 'candidate').map((p) => p.username)} />
          )}

          <section className="flex h-[26rem] flex-col overflow-hidden rounded-xl border bg-card lg:h-[calc(100svh-15rem)] lg:min-h-[28rem]">
            <div role="tablist" className="flex border-b px-2 text-sm">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5',
                    tab === t.key ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                  {'count' in t && <span className="tnum rounded bg-muted px-1.5 text-xs">{t.count}</span>}
                </button>
              ))}
            </div>
            {tab === 'chat' && (
              <>
                <MessageList messages={chat.messages} currentUserId={user?.id ?? ''} isLoading={chat.status === 'connecting'} />
                <TypingIndicator users={chat.typingUsers} />
                <Composer
                  onSend={chat.sendMessage}
                  onStartTyping={chat.startTyping}
                  onStopTyping={chat.stopTyping}
                  disabled={isEnded || chat.status !== 'connected'}
                  disabledReason={isEnded ? 'This room has ended. The chat is read-only.' : 'Reconnecting to the chat…'}
                />
              </>
            )}
            {tab === 'question' && (
              <div className="grid content-start gap-3 overflow-y-auto p-4">
                {chat.pinnedQuestion ? (
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{chat.pinnedQuestion}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No question pinned. The candidate sees the pinned question above their editor.</p>
                )}
                {canControl && !isEnded && (
                  <div>
                    <Button variant="outline" size="sm" onClick={() => setPinOpen(true)}>
                      {chat.pinnedQuestion ? <Pencil aria-hidden /> : <Pin aria-hidden />}
                      {chat.pinnedQuestion ? 'Edit question' : 'Pin a question'}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {tab === 'people' && (
              <div className="overflow-y-auto p-4">
                <ParticipantsList participants={room.participants} ownerId={room.ownerId} currentUserId={user?.id ?? ''} />
              </div>
            )}
          </section>
        </div>
      </div>

      {!isEnded && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border bg-card p-1.5 shadow-sm">
          <CallBar
            joined={call.joined}
            joining={call.joining}
            local={call.local}
            canShare={isCandidate}
            onJoin={() => void call.join()}
            onLeave={call.leave}
            onToggleMic={call.toggleMic}
            onToggleCam={call.toggleCam}
            onShare={() => void call.startShare()}
            onStopShare={call.stopShare}
            onSwitchDevice={(kind, deviceId) => void call.switchDevice(kind, deviceId)}
          />
        </div>
      )}

      <PinDialog
        key={pinOpen ? 'open' : 'closed'}
        open={pinOpen}
        onOpenChange={setPinOpen}
        current={chat.pinnedQuestion}
        onPin={(question) => {
          chat.pinQuestion(question)
          setPinOpen(false)
        }}
      />

      <AlertDialog open={endOpen} onOpenChange={setEndOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this room?</AlertDialogTitle>
            <AlertDialogDescription>
              The call ends and the room closes for everyone. The chat stays readable, but no one can send messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => stateMutation.mutate('ended')}>
              End room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** The video tiles along the top: yourself first, then everyone else. */
function VideoStrip({ call, name, ended }: { call: ReturnType<typeof useCall>; name: string; ended: boolean }) {
  if (!call.joined) {
    return (
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-3 text-sm">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-brand">
          <Video className="size-4" aria-hidden />
        </span>
        <span className="text-muted-foreground">
          {ended ? 'The room has ended, and so has its call.' : 'You are not in the call. Join it from the bar below to see and hear the others.'}
        </span>
      </div>
    )
  }
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
      <VideoTile name={name} stream={call.local.camera} mic={call.local.mic} cam={call.local.cam} self className="w-44 shrink-0 sm:w-52" />
      {call.peers.map((p) => (
        <VideoTile
          key={p.socketId}
          name={p.username}
          stream={p.camera}
          mic={p.mic}
          cam={p.cam}
          connecting={p.connection !== 'connected'}
          className="w-44 shrink-0 sm:w-52"
        />
      ))}
    </div>
  )
}

/** Above the candidate's editor: a call to share, or a quiet "you're sharing". */
function ShareStrip({ joined, sharing, onShare, onStop }: { joined: boolean; sharing: boolean; onShare: () => void; onStop: () => void }) {
  if (sharing) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
        <LiveDot />
        <span className="font-medium">You're sharing your screen</span>
        <span className="hidden text-muted-foreground sm:inline">The interviewers see your editor and output.</span>
        <Button variant="outline" size="sm" className="ml-auto h-7" onClick={onStop}>
          Stop sharing
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
        <ScreenShare className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Share your screen</span>
        <span className="block text-muted-foreground">
          {joined ? 'The interviewers can only see your code while you share this tab.' : 'Join the call first, then share this tab so the interviewers can see your code.'}
        </span>
      </span>
      {joined && (
        <Button size="sm" onClick={onShare}>
          <ScreenShare aria-hidden />
          Share screen
        </Button>
      )}
    </div>
  )
}

function QuestionStrip({ question }: { question: string }) {
  return (
    <details open className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-brand">
          <Pin className="size-3.5" aria-hidden />
        </span>
        <span className="font-semibold">Question</span>
        <span className="truncate text-muted-foreground group-open:hidden">{question}</span>
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <p className="border-t px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap">{question}</p>
    </details>
  )
}

/** What interviewers watch: the candidate's shared screen. */
function Stage({ joined, peers, participants }: { joined: boolean; peers: CallPeer[]; participants: string[] }) {
  const frame = useRef<HTMLDivElement>(null)
  const sharer = peers.find((p) => p.screen && p.role === 'candidate') ?? peers.find((p) => p.screen)
  const height = 'lg:h-[calc(100svh-15rem)] lg:min-h-[28rem]'

  if (!sharer) {
    const who = participants[0] ?? 'The candidate'
    return (
      <Empty className={height}>
        <h2 className="text-base font-semibold">{joined ? `${who} isn't sharing their screen` : 'Join the call to watch the candidate'}</h2>
        <p className="text-sm text-muted-foreground">
          {joined
            ? 'Their editor appears here as soon as they share. They see a prompt to share above their editor.'
            : "The candidate's editor reaches you as a screen share, once you're both in the call."}
        </p>
      </Empty>
    )
  }
  return (
    <section ref={frame} className={cn('flex flex-col overflow-hidden rounded-xl border bg-card', height)}>
      <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
        <LiveDot />
        <span className="font-medium">{sharer.username}'s screen</span>
        <span className="hidden text-muted-foreground sm:inline">· you see what they see</span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Full screen" onClick={() => void frame.current?.requestFullscreen?.()}>
          <Maximize2 aria-hidden />
        </Button>
      </div>
      <div className="min-h-64 flex-1 bg-black">
        <StreamVideo stream={sharer.screen} muted className="object-contain" />
      </div>
    </section>
  )
}

function Empty({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('grid place-items-center rounded-xl border border-dashed bg-card p-8 text-center', className)}>
      <div className="grid max-w-sm justify-items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <MonitorOff className="size-5" aria-hidden />
        </span>
        {children}
      </div>
    </section>
  )
}
