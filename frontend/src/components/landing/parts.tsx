// Building blocks of the landing page.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { LogoMark } from '@/components/common/LogoMark'
import { JOIN_CODE_LENGTH } from '@/components/common/JoinCodeInput'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { BTN, activityLevels } from '@/lib/landing'

export function LandingNav() {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const small = 'inline-flex h-[42px] items-center px-[18px] text-[15px] font-semibold whitespace-nowrap'
  return (
    <header className="landing-wrap">
      <nav aria-label="Main" className="flex h-[76px] items-center gap-3 sm:gap-8">
        <Link to="/" className="flex items-center gap-2.5 font-heading text-[17px] sm:text-[19px]">
          <LogoMark />
          InterviewHub
        </Link>
        <div className="hidden gap-7 lg:flex">
          {[['#rooms', 'Interviews'], ['#contests', 'Contests'], ['#practice', 'Practice'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} className="font-medium underline-offset-[5px] hover:underline">
              {label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Switch theme"
            className="grid size-10 place-items-center hover:bg-foreground/8 [&_svg]:size-5"
          >
            {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
          </button>
          {isBootstrapping ? null : isAuthenticated ? (
            <Link to="/dashboard" className={cn(small, 'bg-gold text-[#16241a] hover:bg-gold-deep')}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden font-medium underline-offset-[5px] hover:underline sm:inline">
                Sign in
              </Link>
              <Link to="/register" className={cn(small, 'bg-gold text-[#16241a] hover:bg-gold-deep')}>
                Create account
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

// The backend's join-code alphabet leaves out I, O, 0 and 1.
const CODE = new RegExp(`^[A-HJ-NP-Z2-9]{${JOIN_CODE_LENGTH}}$`)

/** "Have a room code?": sends the code to the join page (through sign-in). */
export function JoinCodeForm() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [hint, setHint] = useState(`${JOIN_CODE_LENGTH} characters, from your interviewer.`)
  return (
    <form
      noValidate
      className="grid max-w-[440px] gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (CODE.test(code)) navigate(`/rooms/join?code=${code}`)
        else setHint(`Room codes are ${JOIN_CODE_LENGTH} letters and numbers, without 0, 1, I or O.`)
      }}
    >
      <label htmlFor="room-code" className="text-[15px] font-semibold">
        Have a room code?
      </label>
      <div className="flex">
        <input
          id="room-code"
          value={code}
          maxLength={JOIN_CODE_LENGTH}
          autoComplete="off"
          spellCheck={false}
          placeholder="K7P3Q"
          aria-describedby="room-code-hint"
          onChange={(e) => {
            const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
            setCode(next)
            setHint(`${next.length} of ${JOIN_CODE_LENGTH} characters`)
          }}
          className="h-[52px] w-0 min-w-0 flex-1 bg-flesh px-4 font-heading text-xl font-semibold tracking-[0.18em] uppercase placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep"
        />
        <button type="submit" className={cn(BTN, 'bg-foreground text-background hover:bg-foreground/85')}>
          Join room
        </button>
      </div>
      <p id="room-code-hint" aria-live="polite" className="min-h-[1.4em] text-sm text-muted-foreground">
        {hint}
      </p>
    </form>
  )
}

/** A list with small square bullets. */
export function SquareList({ items, bullet = 'bg-gold' }: { items: ReactNode[]; bullet?: string }) {
  return (
    <ul className="grid gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="relative pl-[26px]">
          <span className={cn('absolute top-[0.42em] left-0 size-3', bullet)} aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  )
}

const LEVEL_BG = ['bg-[var(--graph-0)]', 'bg-[var(--graph-1)]', 'bg-[var(--graph-2)]', 'bg-[var(--graph-3)]', 'bg-[var(--graph-4)]']

/** The hero's field: twelve weeks of days, one square each, filling in on load. */
export function ActivityField() {
  const levels = activityLevels(12, 11)
  return (
    <div
      aria-hidden
      className="relative mt-10 ml-[clamp(20px,3.2vw,48px)] grid auto-cols-[var(--sq)] grid-flow-col grid-rows-[repeat(7,var(--sq))] gap-[5px] [--sq:40px] lg:absolute lg:top-10 lg:right-[calc(-1*var(--sq))] lg:left-[52%] lg:mt-0 lg:ml-0 lg:gap-2 lg:[--sq:clamp(48px,5.6vw,88px)]"
    >
      {levels.map((level, i) => (
        <i
          key={i}
          className={cn('square-in', LEVEL_BG[level], i === levels.length - 3 && 'ring-4 ring-foreground ring-inset')}
          style={{ animation: 'square-in 0.5s cubic-bezier(0.2,0.7,0.2,1) both', animationDelay: `${(Math.floor(i / 7) * 3 + (i % 7)) * 28}ms` }}
        />
      ))}
    </div>
  )
}

// On the dark score panel the graph runs from deep green to gold.
const PANEL_BG = ['bg-[#223326]', 'bg-[#4c6a2f]', 'bg-[#86b547]', 'bg-[#f0a81c]', 'bg-[#ffc72c]']

/** A year of days for the score panel; phones show the last half year. */
export function YearGraph() {
  const weeks = 52
  return (
    <div className="grid grid-flow-col grid-rows-[repeat(7,auto)] gap-1" style={{ gridAutoColumns: '1fr' }}>
      {activityLevels(weeks, 5).map((level, i) => (
        <i key={i} className={cn('aspect-square rounded-[3px]', PANEL_BG[level], i < (weeks / 2) * 7 && 'max-sm:hidden')} />
      ))}
    </div>
  )
}
