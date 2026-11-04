import type { ConnectionStatus as Status } from '@/lib/sockets'
import { cn } from '@/lib/utils'

const LABEL: Record<Status, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Reconnecting…',
  error: 'Offline',
}

/** The chat socket's state: a turquoise dot when live. */
export function ConnectionStatus({ status }: { status: Status }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-1.5', status === 'error' && 'text-danger')}>
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          status === 'connected' ? 'bg-primary' : 'animate-pulse bg-current',
        )}
      />
      {LABEL[status]}
    </span>
  )
}
