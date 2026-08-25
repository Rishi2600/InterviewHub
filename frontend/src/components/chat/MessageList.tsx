import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, MessagesSquare } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { SkeletonRows } from '@/components/ui/Skeleton'
import type { Message } from '@/types'

const NEAR_BOTTOM_PX = 80

/**
 * Scroll behaviour is the fiddly part: auto-follow new messages only when the
 * user is already at the bottom. If they've scrolled up to read history, we
 * leave them there and offer a "jump to latest" affordance instead.
 */
export function MessageList({
  messages,
  currentUserId,
  isLoading,
}: {
  messages: Message[]
  currentUserId: string
  isLoading: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const prevCount = useRef(messages.length)

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    setUnreadCount(0)
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distance < NEAR_BOTTOM_PX
    setIsPinnedToBottom(atBottom)
    if (atBottom) setUnreadCount(0)
  }

  useLayoutEffect(() => {
    const grew = messages.length > prevCount.current
    prevCount.current = messages.length
    if (!grew) return

    if (isPinnedToBottom) {
      scrollToBottom('smooth')
    } else {
      setUnreadCount((c) => c + 1)
    }
  }, [messages.length, isPinnedToBottom])

  // Jump to the bottom without animation when history first arrives.
  useEffect(() => {
    if (!isLoading && messages.length > 0) scrollToBottom('auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden p-4">
        <SkeletonRows rows={5} />
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chat messages"
      >
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="size-5" />}
            title="No messages yet"
            description="Say hello — messages appear here in real time for everyone in the room."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((message, i) => {
              const prev = messages[i - 1]
              // Group consecutive messages from the same author.
              const showAuthor =
                message.type === 'system' ||
                !prev ||
                prev.type === 'system' ||
                prev.senderId !== message.senderId

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === currentUserId}
                  showAuthor={showAuthor}
                />
              )
            })}
          </ul>
        )}
      </div>

      {!isPinnedToBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => scrollToBottom()}
            leadingIcon={<ArrowDown className="size-3" />}
            className="pointer-events-auto animate-rise bg-raised"
          >
            {unreadCount > 0 ? (
              <>
                <span className="num">{unreadCount}</span> new
              </>
            ) : (
              'Jump to latest'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}