import { Badge } from '@/components/ui/badge'
import type { RoomState } from '@/types'

const LABEL: Record<RoomState, string> = {
  waiting: 'Waiting',
  active: 'Active',
  ended: 'Ended',
}

/** One look per room state: active is filled turquoise, waiting is grey and
 *  ended is outlined and dimmed. Contests use PhaseBadge. */
export function StatusBadge({ state }: { state: RoomState }) {
  if (state === 'active') return <Badge>{LABEL[state]}</Badge>
  if (state === 'waiting') return <Badge variant="secondary">{LABEL[state]}</Badge>
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {LABEL[state]}
    </Badge>
  )
}
