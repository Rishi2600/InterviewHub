import { cn } from '@/lib/utils'

/** A turquoise dot with a slow ping: something is live right now. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-2 shrink-0', className)} aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
      <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
  )
}
