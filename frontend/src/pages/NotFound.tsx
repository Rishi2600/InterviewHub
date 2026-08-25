import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-5">
      <p className="num text-display text-ink-faint">404</p>
      <div>
        <h1 className="text-heading text-ink">Page not found</h1>
        <p className="mt-1.5 text-caption text-ink-muted">
          That link doesn't lead anywhere in InterviewHub.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong px-3.5 text-caption text-ink transition-colors duration-[var(--duration-fast)] hover:bg-surface"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to dashboard
      </Link>
    </div>
  )
}