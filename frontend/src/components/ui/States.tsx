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
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)]',
        'border border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      <span className="text-ink-faint" aria-hidden>
        {icon ?? <Inbox className="size-7" />}
      </span>
      <div>
        <p className="text-subheading font-medium text-ink">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-caption text-ink-muted">{description}</p>
        )}
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
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)]',
        'border border-danger/30 bg-danger-soft/30 px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle aria-hidden className="size-7 text-danger" />
      <div>
        <p className="text-subheading font-medium text-ink">{title}</p>
        {message && <p className="mx-auto mt-1 max-w-sm text-caption text-ink-muted">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} leadingIcon={<RefreshCw className="size-3.5" />}>
          Try again
        </Button>
      )}
    </div>
  )
}