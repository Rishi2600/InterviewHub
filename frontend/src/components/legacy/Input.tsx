import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leadingIcon?: ReactNode
  /** Codes, ids and other figures render mono + tabular. */
  numeric?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leadingIcon, numeric = false, className, id, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}

      <div className="relative">
        {leadingIcon && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          >
            {leadingIcon}
          </span>
        )}
        <input
          {...rest}
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full rounded-[var(--radius-control)] border bg-surface px-3 text-body text-ink',
            'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-peaks)]',
            'hover:border-line-strong focus:border-line-strong',
            'disabled:cursor-not-allowed disabled:text-ink-disabled',
            leadingIcon && 'pl-9',
            numeric && 'num',
            error ? 'border-clay' : 'border-line',
            className,
          )}
        />
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-micro text-clay">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-micro text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
})
