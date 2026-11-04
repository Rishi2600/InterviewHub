import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Copy, Pin, Play, Square, Users, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/legacy/Button'
import { Dialog } from '@/components/legacy/Dialog'
import { Input } from '@/components/legacy/Input'
import { RoomStateBadge } from '@/components/legacy/Badge'
import { Skeleton, SkeletonRows } from '@/components/legacy/Skeleton'
import { ErrorState } from '@/components/legacy/States'
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
    <div className="animate-rise">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-6 pb-6">
        <div className="min-w-0">
          <p className="label mb-3">Interview room</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading text-ink">{room.title}</h1>
            <RoomStateBadge state={room.state} />
            <ConnectionPill status={chat.status} />
          </div>

          <button
            onClick={handleCopyCode}
            className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 py-1.5 transition-colors duration-[var(--duration-fast)] hover:border-line-strong"
            aria-label={`Room code ${room.code.split('').join(' ')}. Click to copy.`}
          >
            <span className="num text-caption tracking-[0.2em] text-ink">{room.code}</span>
            {copied ? (
              <Check className="size-3 text-sage" aria-hidden />
            ) : (
              <Copy className="size-3 text-ink-faint" aria-hidden />
            )}
            <span className="sr-only" role="status">
              {copied ? 'Code copied' : ''}
            </span>
          </button>
        </div>

        {canControl && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPinDraft(chat.pinnedQuestion ?? '')
                setPinDialogOpen(true)
              }}
              leadingIcon={<Pin className="size-3" />}
              disabled={isEnded}
            >
              {chat.pinnedQuestion ? 'Edit question' : 'Pin question'}
            </Button>

            {/* Start is the one primary action while the room is waiting;
                once it is running, nothing on this screen is sand. */}
            {room.state === 'waiting' && (
              <Button
                size="sm"
                onClick={() => stateMutation.mutate('active')}
                isLoading={stateMutation.isPending}
                leadingIcon={<Play className="size-3" />}
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
                leadingIcon={<Square className="size-3" />}
              >
                End
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-6 border-t border-line pt-6 lg:grid-cols-[1fr_17rem]">
        {/* Chat */}
        <div className="flex h-[clamp(28rem,68vh,44rem)] flex-col overflow-hidden rounded-[var(--radius-container)] border border-line bg-surface">
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
        </div>

        {/* Participants */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="label mb-4 flex items-center gap-2">
            <Users className="size-3" aria-hidden />
            Participants
            <span className="num text-ink-muted">{room.participants.length}</span>
          </p>
          <ParticipantsList
            participants={room.participants}
            ownerId={room.ownerId}
            currentUserId={user?.id ?? ''}
          />
        </aside>
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
        connected ? 'text-sage' : 'text-wheat'
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
    <div>
      <div className="pb-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-3 h-7 w-28" />
      </div>
      <div className="grid gap-6 border-t border-line pt-6 lg:grid-cols-[1fr_17rem]">
        <div className="h-[clamp(28rem,68vh,44rem)] rounded-[var(--radius-container)] border border-line bg-surface p-5">
          <SkeletonRows rows={6} />
        </div>
        <div>
          <Skeleton className="mb-4 h-5 w-32" />
          <SkeletonRows rows={3} />
        </div>
      </div>
    </div>
  )
}