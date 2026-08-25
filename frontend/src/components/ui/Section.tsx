import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Sections replace cards. Structure in this product comes from a full-width
 * 1px rule plus space -- never a bordered, shadowed, rounded box. Set
 * `divided={false}` on the first section of a screen so it does not open
 * with a stray rule.
 */
export function Section({
  children,
  className,
  divided = true,
  ...rest
}: HTMLAttributes<HTMLElement> & { divided?: boolean }) {
  return (
    <section
      {...rest}
      className={cn(divided && 'border-t border-line pt-8', 'pb-2', className)}
    >
      {children}
    </section>
  )
}

/**
 * A section head: optional mono/uppercase eyebrow, a narrow-and-heavy title,
 * and a single optional action on the right.
 */
export function SectionHeader({
  label,
  title,
  description,
  action,
  className,
}: {
  label?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-6', className)}>
      <div className="min-w-0">
        {label && <p className="label mb-2">{label}</p>}
        <h2 className="text-subheading text-ink">{title}</h2>
        {description && <p className="mt-1.5 text-caption text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
