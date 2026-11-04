import { Loader2 } from 'lucide-react'

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background"
    >
      <Loader2 aria-hidden className="size-5 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
