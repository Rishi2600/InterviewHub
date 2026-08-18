import { Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function PinnedBanner({
  question,
  canUnpin,
  onUnpin,
}: {
  question: string
  canUnpin: boolean
  onUnpin: () => void
}) {
  return (
    <div
      aria-live="polite"
      className="flex animate-rise items-start gap-3 border-b border-accent/30 bg-accent-soft/40 px-4 py-3"
    >
      <Pin aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-micro font-medium uppercase tracking-wide text-accent">
          Pinned question
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-body text-ink">{question}</p>
      </div>
      {canUnpin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnpin}
          leadingIcon={<PinOff className="size-3.5" />}
          className="shrink-0"
        >
          Unpin
        </Button>
      )}
    </div>
  )
}