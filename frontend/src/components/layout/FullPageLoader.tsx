import { Loader2 } from 'lucide-react'

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ground"
    >
      <Loader2 aria-hidden className="size-5 animate-spin text-sand" />
      <p className="text-caption text-ink-muted">{label}</p>
    </div>
  )
}