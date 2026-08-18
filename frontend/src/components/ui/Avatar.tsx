import { cn, hueFromId, initials } from '@/lib/utils'

const SIZES = {
  sm: 'size-7 text-micro',
  md: 'size-9 text-caption',
  lg: 'size-20 text-heading',
} as const

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
  const hue = hueFromId(id)

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn(
          'shrink-0 rounded-full border border-line object-cover',
          SIZES[size],
          className,
        )}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{
        backgroundColor: `oklch(0.35 0.09 ${hue})`,
        color: `oklch(0.9 0.09 ${hue})`,
      }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}