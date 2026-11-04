import { Badge } from '@/components/ui/badge'
import type { ContestState, RoomState } from '@/types'

const LABEL: Record<RoomState | ContestState, string> = {
  waiting: 'Waiting',
  active: 'Active',
  draft: 'Draft',
  ended: 'Ended',
}

/** One look per state: active is filled turquoise, waiting is grey, draft is
 *  outlined and ended is outlined and dimmed. */
export function StatusBadge({ state }: { state: RoomState | ContestState }) {
  if (state === 'active') return <Badge>{LABEL[state]}</Badge>
  if (state === 'waiting') return <Badge variant="secondary">{LABEL[state]}</Badge>
  return (
    <Badge variant="outline" className={state === 'ended' ? 'text-muted-foreground' : undefined}>
      {LABEL[state]}
    </Badge>
  )
}
