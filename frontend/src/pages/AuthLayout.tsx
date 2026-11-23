import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/common/LogoMark'
import { SquareList } from '@/components/landing/parts'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

/** Two columns: the form on the left, a green panel on the right (hidden on
 *  small screens) whose content each page chooses. */
export function AuthLayout({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string
  subtitle: string
  aside: ReactNode
  children: ReactNode
}) {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-heading text-lg">
            <LogoMark />
            InterviewHub
          </Link>
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Switch theme">
            {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-sm gap-6">
            <div className="grid gap-1 text-center">
              <h1 className="text-3xl">{title}</h1>
              <p className="text-sm text-balance text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
      <aside className="hidden flex-col justify-center gap-10 bg-crown p-10 text-cream lg:flex xl:p-16">{aside}</aside>
    </div>
  )
}

const PANEL_H2 = 'text-[clamp(36px,3.6vw,56px)] leading-[0.98]'

function Block({ title, items, className, bullet }: { title?: string; items: string[]; className: string; bullet: string }) {
  return (
    <div className={cn('grid gap-3.5 p-7', className)}>
      {title && <h3 className="text-[28px]">{title}</h3>}
      <SquareList bullet={bullet} items={items} />
    </div>
  )
}

/** Register: what each kind of account is for, the one choice on that page. */
export function AccountKinds() {
  return (
    <>
      <h2 className={PANEL_H2}>Candidate or interviewer?</h2>
      <div className="grid gap-2">
        <Block
          title="Candidate"
          className="bg-gold text-[#16241a]"
          bullet="bg-crown"
          items={['Join interview rooms with a code', 'Practise with the AI interviewer and drills', 'Enter contests and build a score out of 10']}
        />
        <Block
          title="Interviewer"
          className="bg-crown-deep"
          bullet="bg-gold"
          items={['Run interview rooms and review each candidate', 'Host 2 contests a month for free', "See candidates' scores on their profiles"]}
        />
      </div>
      <p className="text-[15px] opacity-90">Both accounts are free.</p>
    </>
  )
}

/** Sign in: what is waiting on the other side. */
export function WelcomeBack() {
  return (
    <>
      <h2 className={PANEL_H2}>Welcome back</h2>
      <Block
        className="bg-crown-deep"
        bullet="bg-gold"
        items={['Your interview rooms and their reviews', "Contests you've joined, and their results", 'Practice, drills and your score']}
      />
    </>
  )
}
