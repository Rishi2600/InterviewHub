import type { ReactNode } from 'react'
import { MessagesSquare, Mountain, Radio, Trophy } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: MessagesSquare, text: 'Live interview rooms with real-time chat' },
  { icon: Trophy, text: 'Scored contests with a leaderboard that updates instantly' },
  { icon: Radio, text: 'Pin questions everyone sees at once' },
]

/** Split layout: the form on the left, a quiet product pitch on the right
 *  that collapses away on narrow screens. Structure is hairlines and space --
 *  no glows, no cards. */
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
      <div className="flex items-center justify-center px-gutter py-12">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-10 flex items-center gap-2">
            <Mountain className="size-4 text-sand" aria-hidden />
            <span className="display-tight text-subheading text-ink">InterviewHub</span>
          </div>

          <h1 className="text-heading text-ink">{title}</h1>
          <p className="mt-2 mb-8 text-caption text-ink-muted">{subtitle}</p>

          {children}
        </div>
      </div>

      <aside className="hidden items-center justify-center border-l border-line bg-surface lg:flex">
        <ul className="flex max-w-sm flex-col px-12">
          {HIGHLIGHTS.map(({ icon: Icon, text }, i) => (
            <li
              key={text}
              className={`flex items-start gap-4 py-6 ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-taupe" aria-hidden />
              <p className="text-caption text-ink-muted">{text}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
