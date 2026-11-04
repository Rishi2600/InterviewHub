import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

/**
 * The two non-happy states every screen owes the user. Loading lives in
 * Skeleton.tsx; success is the screen itself.
 */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start justify-center gap-3 px-1 py-8 text-left',
        className,
      )}
    >
      <span className="text-ink-disabled" aria-hidden>
        {icon ?? <Inbox className="size-6" />}
      </span>
      <div>
        <p className="text-caption text-ink">{title}</p>
        {description && <p className="mt-1 max-w-sm text-caption text-ink-faint">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 border-l-2 border-clay bg-surface px-5 py-5 text-left',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="size-5 text-clay" />
      <div>
        <p className="text-caption text-ink">{title}</p>
        {message && <p className="mt-1 max-w-sm text-caption text-ink-muted">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leadingIcon={<RefreshCw className="size-3.5" />}>
          Try again
        </Button>
      )}
    </div>
  )
}