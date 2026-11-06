import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MessagesSquare, Moon, Pin, Sun, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

const HIGHLIGHTS = [
  { icon: MessagesSquare, title: 'Interview rooms', text: 'Live chat with a join code you share with the candidate.' },
  { icon: Pin, title: 'Pinned questions', text: 'Put the problem at the top of the chat for everyone at once.' },
  { icon: Trophy, title: 'Public contests', text: 'Timed quizzes anyone can join, ranked the moment they end.' },
]

/** Two columns, as in shadcn's login blocks: the form on the left, a short
 *  description of the product on the right (hidden on small screens). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2 font-heading font-semibold">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessagesSquare className="size-4" aria-hidden />
            </span>
            InterviewHub
          </Link>
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Switch theme">
            {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-sm gap-6">
            <div className="grid gap-1 text-center">
              <h1 className="text-2xl font-semibold">{title}</h1>
              <p className="text-sm text-balance text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
      <aside className="hidden items-center justify-center border-l bg-muted/40 p-10 lg:flex">
        <ul className="grid max-w-sm gap-8">
          {HIGHLIGHTS.map(({ icon: Icon, title: heading, text }) => (
            <li key={heading} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-brand">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="grid gap-1">
                <p className="font-heading font-semibold">{heading}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
