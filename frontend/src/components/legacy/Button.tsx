import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  leadingIcon?: ReactNode
  fullWidth?: boolean
}

/**
 * `primary` is sand, and sand means primary. Exactly one primary button per
 * screen -- a second one is a bug. Everything else is secondary or ghost.
 * Elevation is a surface step and a hairline; there are no shadows here.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sand text-ground hover:bg-sand/90 disabled:hover:bg-sand',
  secondary:
    'bg-transparent text-ink border border-line-strong hover:bg-surface disabled:hover:bg-transparent',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface hover:text-ink disabled:hover:bg-transparent',
  danger:
    'bg-transparent text-clay border border-clay/50 hover:bg-clay hover:text-ground disabled:hover:bg-transparent disabled:hover:text-clay',
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-micro gap-1.5',
  md: 'h-9 px-3.5 text-caption gap-2',
  lg: 'h-10 px-4 text-body gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leadingIcon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-peaks)]',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {isLoading ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : leadingIcon}
      {children}
    </button>
  )
}
