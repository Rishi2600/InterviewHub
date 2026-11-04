import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, Copy, Ellipsis, Link2, Pin, PinOff, Play, Square } from 'lucide-react'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ErrorState } from '@/components/common/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { Composer } from '@/components/chat/Composer'
import { ConnectionStatus } from '@/components/chat/ConnectionStatus'
import { MessageList } from '@/components/chat/MessageList'
import { ParticipantsList } from '@/components/chat/ParticipantsList'
import { PinDialog } from '@/components/chat/PinDialog'
import { PinnedBanner } from '@/components/chat/PinnedBanner'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { useAuth } from '@/hooks/useAuth'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useCopy } from '@/hooks/useCopy'
import { getRoom, setRoomState } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import type { RoomState } from '@/types'

const STATE_TOAST: Record<RoomState, string> = {
  waiting: 'Room is waiting',
  active: 'Room started',
  ended: 'Room ended',
}

export function Room() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const copy = useCopy()
  const [pinOpen, setPinOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  const roomQuery = useQuery({ queryKey: ['room', id], queryFn: () => getRoom(id!), enabled: Boolean(id) })
  const room = roomQuery.data
  const canControl = Boolean(room && user && (room.ownerId === user.id || user.role === 'admin'))
  const chat = useChatSocket(id)

  // Seed the pinned question from the room document, then let the socket own it.
  useEffect(() => {
    if (room) chat.setPinnedQuestion(room.pinnedQuestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?._id])

  const stateMutation = useMutation({
    mutationFn: (state: RoomState) => setRoomState(id!, state),
    onSuccess: (updated) => {
      queryClient.setQueryData(['room', id], updated)
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success(STATE_TOAST[updated.state])
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not change the room')),
  })

  if (roomQuery.isLoading) return <RoomSkeleton />
  if (roomQuery.isError || !room) {
    return (
      <ErrorState
        title="Couldn't load this room"
        message={errorMessage(roomQuery.error, 'The room may not exist, or you may not have access.')}
        onRetry={() => void roomQuery.refetch()}
      />
    )
  }

  const isEnded = room.state === 'ended'
  const messageCount = chat.messages.filter((m) => m.type === 'user').length

  return (
    <>
      <PageHeader
        title={
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Link to="/" className="hidden hover:text-foreground sm:inline">
              Dashboard
            </Link>
            <ChevronRight className="hidden size-3.5 sm:inline" aria-hidden />
            <span className="truncate text-foreground">{room.title}</span>
          </nav>
        }
      >
        {canControl && !isEnded && (
          <Button variant="outline" size="sm" onClick={() => setPinOpen(true)}>
            <Pin aria-hidden />
            <span className="hidden sm:inline">{chat.pinnedQuestion ? 'Edit question' : 'Pin question'}</span>
          </Button>
        )}
        {canControl && room.state === 'waiting' && (
          <Button size="sm" onClick={() => stateMutation.mutate('active')} disabled={stateMutation.isPending}>
            <Play aria-hidden />
            Start
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="More actions">
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
            {canControl && !isEnded && chat.pinnedQuestion && (
              <DropdownMenuItem onSelect={chat.unpinQuestion}>
                <PinOff aria-hidden />
                Unpin question
              </DropdownMenuItem>
            )}
            {canControl && !isEnded && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setEndOpen(true)}>
                  <Square aria-hidden />
                  End room
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{room.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <StatusBadge state={room.state} />
            <ConnectionStatus status={chat.status} />
            <span>Opened {formatDateTime(room.createdAt)}</span>
          </div>
        </div>
        <div className="flex">
          <span className="flex h-9 items-center rounded-l-md border border-r-0 px-3 font-mono text-sm tracking-[0.16em]">
            {room.code}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="rounded-l-none"
            aria-label="Copy join code"
            onClick={() => copy(room.code, 'Join code copied')}
          >
            <Copy aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="h-[clamp(32rem,calc(100svh-13rem),56rem)] min-w-0 gap-0 overflow-hidden py-0">
          {chat.pinnedQuestion && <PinnedBanner question={chat.pinnedQuestion} />}
          <MessageList
            messages={chat.messages}
            currentUserId={user?.id ?? ''}
            isLoading={chat.status === 'connecting'}
          />
          <TypingIndicator users={chat.typingUsers} />
          <Composer
            onSend={chat.sendMessage}
            onStartTyping={chat.startTyping}
            onStopTyping={chat.stopTyping}
            disabled={isEnded || chat.status !== 'connected'}
            disabledReason={
              isEnded ? 'This room has ended. The chat is read-only.' : 'Reconnecting to the chat…'
            }
          />
        </Card>

        <div className="grid gap-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Participants</CardTitle>
              <CardDescription>
                {room.participants.length === 1 ? '1 person' : `${room.participants.length} people`} in
                this room
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ParticipantsList
                participants={room.participants}
                ownerId={room.ownerId}
                currentUserId={user?.id ?? ''}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Room</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                <DetailRow label="Join code">
                  <span className="font-mono tracking-[0.12em]">{room.code}</span>
                </DetailRow>
                <DetailRow label="Status">
                  <StatusBadge state={room.state} />
                </DetailRow>
                <DetailRow label="Opened">{formatDateTime(room.createdAt)}</DetailRow>
                <DetailRow label="Messages">{messageCount}</DetailRow>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

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
              The room closes for everyone. The chat stays readable, but no one can send messages.
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
    </>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function RoomSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-80" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="h-[32rem] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </>
  )
}
