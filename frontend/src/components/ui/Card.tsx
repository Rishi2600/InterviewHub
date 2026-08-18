import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
}

export function Card({ children, padded = true, className, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface shadow-panel',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-subheading font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-caption text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}