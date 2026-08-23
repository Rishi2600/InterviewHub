import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Copy, Pin, Play, Square, Users, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { RoomStateBadge } from '@/components/ui/Badge'
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { MessageList } from '@/components/chat/MessageList'
import { Composer } from '@/components/chat/Composer'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { PinnedBanner } from '@/components/chat/PinnedBanner'
import { ParticipantsList } from '@/components/chat/ParticipantsList'
import { useAuth } from '@/hooks/useAuth'
import { useChatSocket } from '@/hooks/useChatSocket'
import { getRoom, setRoomState } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { copyToClipboard } from '@/lib/utils'
import type { RoomState } from '@/types'

export function Room() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pinDraft, setPinDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const roomQuery = useQuery({
    queryKey: ['room', id],
    queryFn: () => getRoom(id!),
    enabled: Boolean(id),
  })

  const room = roomQuery.data
  const isOwner = Boolean(room && user && room.ownerId === user.id)
  const canControl = isOwner || user?.role === 'admin'

  const chat = useChatSocket(id)

  // Seed the pinned banner from the room document, then let the socket own it.
  useEffect(() => {
    if (room) chat.setPinnedQuestion(room.pinnedQuestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?._id])

  const stateMutation = useMutation({
    mutationFn: (state: RoomState) => setRoomState(id!, state),
    onSuccess: (updated) => {
      queryClient.setQueryData(['room', id], updated)
      toast.success(`Room is now ${updated.state}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not change the room state')),
  })

  async function handleCopyCode() {
    if (!room) return
    const ok = await copyToClipboard(room.code)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } else {
      toast.error('Could not copy — select the code and copy manually')
    }
  }

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

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Card className="animate-rise">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-heading font-semibold text-ink">{room.title}</h1>
              <RoomStateBadge state={room.state} />
              <ConnectionPill status={chat.status} />
            </div>

            <button
              onClick={handleCopyCode}
              className="mt-2 inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-ground px-2.5 py-1 transition-colors hover:border-line-strong"
              aria-label={`Room code ${room.code.split('').join(' ')}. Click to copy.`}
            >
              <span className="font-mono text-body tracking-[0.2em] text-ink">{room.code}</span>
              {copied ? (
                <Check className="size-3.5 text-success" aria-hidden />
              ) : (
                <Copy className="size-3.5 text-ink-faint" aria-hidden />
              )}
              <span className="sr-only" role="status">
                {copied ? 'Code copied' : ''}
              </span>
            </button>
          </div>

          {canControl && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPinDraft(chat.pinnedQuestion ?? '')
                  setPinDialogOpen(true)
                }}
                leadingIcon={<Pin className="size-3.5" />}
                disabled={isEnded}
              >
                {chat.pinnedQuestion ? 'Edit question' : 'Pin question'}
              </Button>

              {room.state === 'waiting' && (
                <Button
                  size="sm"
                  onClick={() => stateMutation.mutate('active')}
                  isLoading={stateMutation.isPending}
                  leadingIcon={<Play className="size-3.5" />}
                >
                  Start
                </Button>
              )}

              {!isEnded && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => stateMutation.mutate('ended')}
                  isLoading={stateMutation.isPending}
                  leadingIcon={<Square className="size-3.5" />}
                >
                  End
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        {/* Chat */}
        <Card
          padded={false}
          className="flex h-[clamp(28rem,68vh,44rem)] animate-rise flex-col overflow-hidden"
        >
          {chat.pinnedQuestion && (
            <PinnedBanner
              question={chat.pinnedQuestion}
              canUnpin={Boolean(canControl) && !isEnded}
              onUnpin={chat.unpinQuestion}
            />
          )}

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
              isEnded
                ? 'This room has ended — chat is read-only.'
                : chat.status !== 'connected'
                  ? 'Reconnecting to chat…'
                  : undefined
            }
          />
        </Card>

        {/* Participants */}
        <Card className="animate-rise lg:sticky lg:top-20 lg:self-start">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Users className="size-4 text-ink-faint" aria-hidden />
                Participants
                <span className="text-caption font-normal text-ink-faint">
                  {room.participants.length}
                </span>
              </span>
            }
          />
          <ParticipantsList
            participants={room.participants}
            ownerId={room.ownerId}
            currentUserId={user?.id ?? ''}
          />
        </Card>
      </div>

      <Dialog
        open={pinDialogOpen}
        onClose={() => setPinDialogOpen(false)}
        title="Pin a question"
        description="Everyone in the room sees this immediately."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPinDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pinDraft.trim()}
              onClick={() => {
                chat.pinQuestion(pinDraft.trim())
                setPinDialogOpen(false)
              }}
            >
              Pin question
            </Button>
          </>
        }
      >
        <Input
          label="Question"
          value={pinDraft}
          autoFocus
          placeholder="Reverse a linked list in place."
          onChange={(e) => setPinDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pinDraft.trim()) {
              chat.pinQuestion(pinDraft.trim())
              setPinDialogOpen(false)
            }
          }}
        />
      </Dialog>
    </div>
  )
}

function ConnectionPill({ status }: { status: string }) {
  const connected = status === 'connected'
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 text-micro ${
        connected ? 'text-success' : 'text-warning'
      }`}
    >
      {connected ? (
        <Wifi className="size-3" aria-hidden />
      ) : (
        <WifiOff className="size-3 animate-pulse" aria-hidden />
      )}
      {connected ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline'}
    </span>
  )
}

function RoomSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-3 h-7 w-28" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <Card className="h-[clamp(28rem,68vh,44rem)]">
          <SkeletonRows rows={6} />
        </Card>
        <Card>
          <Skeleton className="mb-4 h-5 w-32" />
          <SkeletonRows rows={3} />
        </Card>
      </div>
    </div>
  )
}