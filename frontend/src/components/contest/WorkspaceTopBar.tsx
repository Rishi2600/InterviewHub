import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clock } from '@/lib/contest-time'

/** The contest workspaces' top bar: back, title, end time and how much of the
 *  contest has gone, with the page's own controls on the right. */
export function WorkspaceTopBar({
  title,
  endAt,
  contestId,
  pct,
  children,
}: {
  title: string
  endAt: string
  contestId: string
  pct: number
  children: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to={`/contests/${contestId}`} aria-label="Back to contest page">
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="hidden text-xs text-muted-foreground sm:block">Ends at {clock(endAt)} for everyone</div>
        </div>
        {children}
      </div>
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </header>
  )
}
