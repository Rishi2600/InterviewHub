import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MoreControl } from '@/hooks/usePagedList'

/** Loads the next page of a list; hidden on the last page. */
export function ShowMore({ more, className }: { more?: MoreControl; className?: string }) {
  if (!more?.hasMore) return null
  return (
    <div className={className ?? 'flex justify-center border-t p-3'}>
      <Button variant="ghost" size="sm" onClick={more.load} disabled={more.loading}>
        {more.loading && <Loader2 className="animate-spin" aria-hidden />}
        Show more
      </Button>
    </div>
  )
}
