import { Avatar } from '@/components/legacy/Avatar'
import { cn, formatTime } from '@/lib/utils'
import type { Message } from '@/types'

/** System lines read as muted, centered narration — never as someone's message. */
function SystemLine({ message }: { message: Message }) {
  return (
    <li className="my-1 flex animate-fade justify-center">
      <span className="rounded-[var(--radius-control)] bg-surface px-2.5 py-1 text-micro text-ink-faint">
        {message.content}
      </span>
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
    <li className={cn('flex animate-rise gap-2.5', isOwn && 'flex-row-reverse')}>
      <div className="w-6 shrink-0">
        {showAuthor && (
          <Avatar name={message.senderName} id={message.senderId ?? message.id} size="sm" />
        )}
      </div>

      <div className={cn('flex max-w-[min(32rem,75%)] flex-col gap-1', isOwn && 'items-end')}>
        {showAuthor && (
          <span className="px-1 text-micro text-ink-faint">
            {isOwn ? 'You' : message.senderName}
          </span>
        )}
        {/* Own vs other is a surface step and a hairline, not a color -- sand
            is reserved for live and primary. */}
        <div
          className={cn(
            'rounded-[var(--radius-container)] border px-3 py-2 text-caption break-words',
            isOwn
              ? 'border-line-strong bg-raised text-ink'
              : 'border-line bg-surface text-ink',
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <time dateTime={message.createdAt} className="num px-1 text-micro text-ink-faint">
          {formatTime(message.createdAt)}
        </time>
      </div>
    </li>
  )
}