import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Nothing to show yet, and what to do about it. */
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
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-10 text-center', className)}>
      <span className="grid size-10 place-items-center rounded-lg border text-muted-foreground [&_svg]:size-5" aria-hidden>
        {icon ?? <Inbox />}
      </span>
      <div className="grid gap-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** A failed load, with a retry. */
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <EmptyState
      icon={<AlertTriangle className="text-danger" />}
      title={title}
      description={message}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden />
            Try again
          </Button>
        )
      }
    />
  )
}
