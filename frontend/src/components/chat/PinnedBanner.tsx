import { Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/legacy/Button'

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
    /* The pinned question is the room's hot surface -- the one thing everyone
       is looking at -- so it earns sand. */
    <div
      aria-live="polite"
      className="flex animate-rise items-start gap-3 border-b border-line bg-sand-soft px-4 py-3.5"
    >
      <Pin aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sand" />
      <div className="min-w-0 flex-1">
        <p className="label text-sand">Pinned question</p>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-caption text-ink">{question}</p>
      </div>
      {canUnpin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUnpin}
          leadingIcon={<PinOff className="size-3" />}
          className="shrink-0"
        >
          Unpin
        </Button>
      )}
    </div>
  )
}