import { cn, hashId, initials } from '@/lib/utils'

const SIZES = {
  sm: 'size-6 text-[0.625rem]',
  md: 'size-8 text-micro',
  lg: 'size-16 text-heading',
} as const

/**
 * Fallback tints stay inside the warm palette rather than generating an
 * arbitrary hue per user -- a rainbow of avatars would fight the system.
 * The pick is deterministic, so a given user keeps the same tint.
 */
const TONES = [
  'bg-sand-soft text-sand',
  'bg-surface text-taupe',
  'bg-raised text-sage',
  'bg-surface text-mist',
  'bg-raised text-wheat',
  'bg-sand-soft text-taupe',
] as const

export function Avatar({
  name,
  id,
  src,
  size = 'md',
  className,
}: {
  name: string
  id: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn(
          'shrink-0 rounded-[var(--radius-pill)] border border-line object-cover',
          SIZES[size],
          className,
        )}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-pill)]',
        'font-medium',
        TONES[hashId(id) % TONES.length],
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
