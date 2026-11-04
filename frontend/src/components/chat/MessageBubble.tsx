import { LogIn } from 'lucide-react'
import { UserAvatar } from '@/components/common/UserAvatar'
import { cn, formatTime } from '@/lib/utils'
import type { Message } from '@/types'

/** Join and leave notices: small, centred, never mistaken for a message. */
function SystemLine({ message }: { message: Message }) {
  return (
    <li className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      <LogIn className="size-3.5" aria-hidden />
      {message.content}
    </li>
  )
}

export function MessageBubble({
  message,
  isOwn,
  showAuthor,
}: {
  message: Message
  isOwn: boolean
  showAuthor: boolean
}) {
  if (message.type === 'system') return <SystemLine message={message} />

  return (
    <li className={cn('flex max-w-[min(40rem,85%)] gap-2.5', isOwn && 'flex-row-reverse self-end')}>
      <div className="w-8 shrink-0">{showAuthor && <UserAvatar name={message.senderName} />}</div>
      <div className={cn('flex min-w-0 flex-col gap-1', isOwn && 'items-end')}>
        {showAuthor && (
          <span className="text-xs text-muted-foreground">
            <span className="mr-1.5 font-medium text-foreground">{isOwn ? 'You' : message.senderName}</span>
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          </span>
        )}
        <p
          className={cn(
            'rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
            isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted',
          )}
        >
          {message.content}
        </p>
      </div>
    </li>
  )
}
