import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface Metric {
  label: string
  value: number | string
  note: string
  accent?: boolean
}

/** One card, its cells divided by hairlines. */
export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <Card className="grid grid-cols-2 gap-0 py-0 lg:grid-cols-4">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={cn(
            'min-w-0 px-6 py-5',
            i % 2 === 1 && 'border-l',
            i >= 2 && 'border-t lg:border-t-0',
            i === 2 && 'lg:border-l',
          )}
        >
          <p className="text-sm text-muted-foreground">{m.label}</p>
          <p className={cn('mt-1 font-heading text-3xl font-semibold tracking-tight', m.accent && 'text-brand')}>
            {m.value}
          </p>
          <p className="truncate text-xs text-muted-foreground">{m.note}</p>
        </div>
      ))}
    </Card>
  )
}
