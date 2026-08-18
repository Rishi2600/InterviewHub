import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leadingIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leadingIcon, className, id, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-caption font-medium text-ink-muted">
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
            'placeholder:text-ink-faint',
            'transition-colors duration-150 ease-[var(--ease-out-soft)]',
            'hover:border-line-strong',
            'disabled:cursor-not-allowed disabled:opacity-60',
            leadingIcon && 'pl-9',
            error ? 'border-danger' : 'border-line',
            className,
          )}
        />
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-caption text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  )
})