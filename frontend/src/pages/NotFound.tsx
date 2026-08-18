import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="font-mono text-display font-semibold text-accent">404</p>
      <div>
        <h1 className="text-heading font-semibold text-ink">Page not found</h1>
        <p className="mt-1 text-body text-ink-muted">
          That link doesn't lead anywhere in InterviewHub.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-surface-raised px-4 text-body font-medium text-ink transition-colors hover:bg-surface-hover"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to dashboard
      </Link>
    </div>
  )
}