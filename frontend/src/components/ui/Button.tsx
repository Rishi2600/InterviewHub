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

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover shadow-panel disabled:hover:bg-accent',
  secondary:
    'bg-surface-raised text-ink border border-line hover:bg-surface-hover hover:border-line-strong disabled:hover:bg-surface-raised',
  ghost:
    'bg-transparent text-ink-muted hover:bg-surface-raised hover:text-ink disabled:hover:bg-transparent',
  danger:
    'bg-danger-soft text-ink border border-danger/40 hover:bg-danger hover:text-accent-ink disabled:hover:bg-danger-soft',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-caption gap-1.5',
  md: 'h-10 px-4 text-body gap-2',
  lg: 'h-11 px-5 text-body gap-2',
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
        'transition-colors duration-150 ease-[var(--ease-out-soft)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {isLoading ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  )
}