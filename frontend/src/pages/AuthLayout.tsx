import type { ReactNode } from 'react'
import { MessagesSquare, Radio, Trophy } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: MessagesSquare, text: 'Live interview rooms with real-time chat' },
  { icon: Trophy, text: 'Scored contests with a leaderboard that updates instantly' },
  { icon: Radio, text: 'Pin questions everyone sees at once' },
]

/** Split layout: the form on the left, a quiet product pitch on the right
 *  that collapses away on narrow screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-7 flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-[var(--radius-control)] bg-accent text-accent-ink"
            >
              <Radio className="size-4" />
            </span>
            <span className="text-subheading font-semibold tracking-tight">InterviewHub</span>
          </div>

          <h1 className="text-display font-semibold text-ink">{title}</h1>
          <p className="mt-2 mb-7 text-body text-ink-muted">{subtitle}</p>

          {children}
        </div>
      </div>

      <aside className="relative hidden items-center justify-center overflow-hidden border-l border-line bg-surface lg:flex">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-96 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 size-80 rounded-full bg-accent/10 blur-3xl"
        />

        <ul className="relative z-10 flex max-w-sm flex-col gap-6 px-10">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-surface-raised text-accent"
              >
                <Icon className="size-4" />
              </span>
              <p className="text-body text-ink-muted">{text}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}