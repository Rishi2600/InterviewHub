import { Pin } from 'lucide-react'

/** The question everyone in the room is working on. */
export function PinnedBanner({ question }: { question: string }) {
  return (
    <div aria-live="polite" className="flex items-start gap-3 border-b bg-muted/40 px-5 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/12 text-brand">
        <Pin className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">Pinned question</p>
        <p className="mt-0.5 text-sm font-medium break-words whitespace-pre-wrap">{question}</p>
      </div>
    </div>
  )
}
