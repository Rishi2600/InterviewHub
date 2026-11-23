import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { LogoMark } from '@/components/common/LogoMark'
import { FeedbackPreview, RoomPreview } from '@/components/landing/previews'
import { ActivityField, JoinCodeForm, LandingNav, SquareList, YearGraph } from '@/components/landing/parts'
import { useAuth } from '@/hooks/useAuth'
import { useReveal } from '@/hooks/useReveal'
import { BTN_GOLD, BTN_SOFT, at } from '@/lib/landing'
import { cn } from '@/lib/utils'

const H2 = 'text-[clamp(36px,4.6vw,72px)] leading-[0.98] font-bold text-balance'
const GRID = 'grid gap-6 lg:grid-cols-12'
const SECTION = 'landing-wrap pt-[clamp(112px,13vw,200px)]'
const YEAR = new Date().getFullYear()

// How a contest works, one fact per line.
const CONTEST_RULES = [
  ['Public', 'Browse every contest without an account. Anyone but the host can enter.'],
  ['Timed', "A fixed start and end. Join late if you like; the clock doesn't wait."],
  ['Judged', 'Quiz answers and code are checked automatically.'],
  ['Ranked', 'The leaderboard is out the moment the contest ends.'],
  ['Rated', "With 10 or more starters, it counts towards each entrant's score."],
]

/** The public front page, for everyone, signed in or not. */
export function Landing() {
  const { isAuthenticated } = useAuth()
  const ref = useReveal<HTMLDivElement>()
  const start = isAuthenticated
    ? { to: '/dashboard', label: 'Open dashboard' }
    : { to: '/register', label: 'Create free account' }

  return (
    <div ref={ref} className="min-h-svh bg-background text-[17px] leading-[1.55]">
      <LandingNav />
      <main id="top">
        <section aria-labelledby="hero-h" className="relative overflow-hidden lg:min-h-[calc(100svh-76px)]">
          <div className="landing-wrap relative z-10 grid content-center pt-8 lg:min-h-[calc(100svh-76px)] lg:py-24">
            <div className="grid max-w-[700px] gap-7 lg:max-w-[min(700px,calc(52vw-clamp(20px,3.2vw,48px)-32px))]">
              <h1 id="hero-h" className="reveal text-[clamp(44px,5.4vw,88px)] leading-[0.98]">
                Talk. Code.
                <br />
                Compete.
              </h1>
              <p className="reveal max-w-[34em] text-xl" style={at(1)}>
                Live coding interviews, public contests and AI practice in one place. Interviewers run rooms and host
                contests. Candidates practise, compete and build a score out of 10.
              </p>
              <div className="reveal flex flex-wrap gap-3" style={at(2)}>
                <Link to={start.to} className={BTN_GOLD}>
                  {start.label}
                </Link>
                <Link to="/contests" className={BTN_SOFT}>
                  Browse contests
                </Link>
              </div>
              <div className="reveal" style={at(3)}>
                <JoinCodeForm />
              </div>
            </div>
          </div>
          <ActivityField />
          <p className="px-[clamp(20px,3.2vw,48px)] pt-3 text-sm text-muted-foreground lg:absolute lg:right-0 lg:bottom-8 lg:z-10 lg:max-w-[36em] lg:text-right">
            Each square is a day: an interview, a contest, a drill or a practice session. Together they feed the score.
          </p>
        </section>

        <section id="rooms" aria-labelledby="rooms-h" className={SECTION}>
          <div className={cn(GRID, 'mb-14 items-end')}>
            <h2 id="rooms-h" className={cn('reveal lg:col-span-6', H2)}>
              Interview in one room
            </h2>
            <div className="grid gap-[18px] lg:col-span-5 lg:col-start-8">
              <p className="reveal" style={at(1)}>
                Share a 5-character code and the candidate joins. Everything the interview needs is on one screen.
              </p>
              <div className="reveal" style={at(2)}>
                <SquareList
                  items={[
                    'Video and voice, with screen sharing',
                    'A chat with the question pinned on top',
                    'An editor that runs JavaScript and Python in the browser',
                    'A written review after the room ends, which the candidate can read',
                  ]}
                />
              </div>
            </div>
          </div>
          <div className="reveal rounded-lg bg-fruit p-4 sm:p-[clamp(20px,4vw,64px)]">
            <RoomPreview />
          </div>
        </section>

        <section id="contests" aria-labelledby="contests-h" className={SECTION}>
          <div className={cn(GRID, 'mb-14 items-end')}>
            <h2 id="contests-h" className={cn('reveal lg:col-span-6', H2)}>
              Contests anyone can enter
            </h2>
            <div className="grid gap-4 lg:col-span-5 lg:col-start-8">
              <p className="reveal" style={at(1)}>
                Timed quiz and code contests, hosted by interviewers. Any interviewer can host 2 a month for free.
              </p>
              <Link to="/contests" className="reveal font-semibold text-brand underline-offset-4 hover:underline" style={at(2)}>
                Browse contests →
              </Link>
            </div>
          </div>
          <dl className="grid gap-y-10">
            {CONTEST_RULES.map(([term, text], i) => (
              <div key={term} className={cn('reveal', GRID, 'items-baseline')} style={at(i)}>
                <dt className="flex items-center gap-4 font-heading text-[clamp(28px,3vw,44px)] leading-none font-bold lg:col-span-4">
                  <span aria-hidden className="size-3 shrink-0 bg-fruit" />
                  {term}
                </dt>
                <dd className="text-xl lg:col-span-7 lg:col-start-6">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="practice" aria-labelledby="practice-h" className={SECTION}>
          <div className={cn(GRID, 'items-center')}>
            <div className="grid gap-5 lg:col-span-5">
              <h2 id="practice-h" className={cn('reveal', H2)}>
                Practise before it counts
              </h2>
              <p className="reveal text-xl" style={at(1)}>
                An AI interviewer asks questions by chat or voice, sets a coding problem and writes feedback in five
                areas. Drills and a coach then work on your weak spots.
              </p>
            </div>
            <div className="reveal min-w-0 rounded-lg bg-tint p-4 sm:p-8 lg:col-span-6 lg:col-start-7">
              <FeedbackPreview />
            </div>
          </div>
        </section>

        <ScoreSection />
        <Pricing signedIn={isAuthenticated} />

        <section aria-labelledby="close-h" className="landing-wrap flex flex-wrap items-end justify-between gap-8 pt-[clamp(112px,13vw,200px)] pb-12">
          <h2 id="close-h" className="reveal max-w-[12em] text-[clamp(40px,6vw,96px)] leading-[0.98] font-bold">
            {isAuthenticated ? 'Pick up where you left off' : 'Start with a free account'}
          </h2>
          <div className="reveal flex flex-wrap gap-3" style={at(1)}>
            <Link to={start.to} className={BTN_GOLD}>
              {start.label}
            </Link>
            {!isAuthenticated && (
              <Link to="/login" className={BTN_SOFT}>
                Sign in
              </Link>
            )}
          </div>
        </section>
      </main>

      <footer className="landing-wrap pt-14 pb-24">
        <p aria-hidden className="flex items-end gap-[clamp(8px,1.4vw,20px)] font-heading text-[clamp(40px,11.5vw,220px)] leading-[0.8] font-bold">
          <LogoMark className="mb-[0.12em] size-[0.42em] [&>span]:rounded-none" />
          InterviewHub
        </p>
        <div className="mt-10 flex flex-wrap justify-between gap-x-8 gap-y-4 text-[15px]">
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            <Link to="/contests" className="hover:underline">Contests</Link>
            <a href="#pricing" className="hover:underline">Pricing</a>
            {isAuthenticated ? (
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="hover:underline">Sign in</Link>
                <Link to="/register" className="hover:underline">Create account</Link>
              </>
            )}
          </nav>
          <span>© {YEAR} InterviewHub</span>
        </div>
      </footer>
    </div>
  )
}

/** The score as a poster: the number, what it is, and a year of days. */
function ScoreSection() {
  return (
    <section
      id="score"
      aria-labelledby="score-h"
      className="mt-[clamp(112px,13vw,200px)] bg-night py-[clamp(96px,11vw,176px)] text-night-ink"
    >
      <div className="landing-wrap">
        <div className={cn(GRID, 'items-end')}>
          <p aria-hidden className="reveal font-heading font-bold text-[clamp(120px,24vw,380px)] leading-[0.8] tracking-[-0.06em] text-fruit lg:col-span-7">
            7.4<span className="text-[0.22em] tracking-[-0.02em] text-night-ink"> / 10</span>
          </p>
          <div className="grid gap-5 pb-3 lg:col-span-5 lg:col-start-8">
            <h2 id="score-h" className="reveal text-[clamp(40px,5.6vw,88px)] leading-[0.98] font-bold text-balance">
              One score out of 10
            </h2>
            <p className="reveal text-lg" style={at(1)}>
              Built from where candidates place in rated contests. Candidates watch it move; interviewers see it on
              their profile, next to badges and a graph of everything they do here.
            </p>
            <div className="reveal flex flex-wrap gap-2" style={at(2)}>
              {['Podium', 'Top 10%', 'Streak', 'First rated'].map((badge, i) => (
                <span
                  key={badge}
                  className={cn('rounded-full px-3 py-1.5 text-[15px] font-semibold', i === 0 ? 'bg-fruit text-fruit-ink' : 'bg-night-soft')}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="reveal mt-16">
          <YearGraph />
        </div>
        <p className="mt-4 flex flex-wrap justify-between gap-4 text-[15px] text-night-ink/80">
          <span>Every square is a day with an interview, a contest, a drill or a practice session.</span>
          <span>sam.r · last 12 months</span>
        </p>
      </div>
    </section>
  )
}

/** Two free plans side by side, and a plain line for what payments will add. */
function Pricing({ signedIn }: { signedIn: boolean }) {
  const cta = signedIn ? { to: '/dashboard', label: 'Open dashboard' } : { to: '/register', label: 'Create account' }
  const plans = [
    {
      name: 'Candidates',
      tile: 'bg-tint',
      bullet: 'bg-fruit',
      items: ['AI practice interviews and drills, within monthly limits', 'Enter any contest', 'Your score, badges and profile'],
    },
    {
      name: 'Interviewers',
      tile: 'bg-fruit text-fruit-ink',
      bullet: 'bg-stem',
      items: ['Interview rooms with video, chat and the editor', 'Reviews after each room', 'Candidate scores on their profiles', 'Host 2 contests a month'],
    },
  ]
  return (
    <section id="pricing" aria-labelledby="pricing-h" className={SECTION}>
      <div className={cn(GRID, 'mb-14 items-end')}>
        <h2 id="pricing-h" className={cn('reveal lg:col-span-6', H2)}>
          Free to start
        </h2>
        <p className="reveal lg:col-span-5 lg:col-start-8" style={at(1)}>
          Candidates never pay. Interviewers pay only to host more than 2 contests in a month.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-2">
        {plans.map((plan, i) => (
          <div key={plan.name} className={cn('reveal grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-lg', plan.tile)} style={at(i)}>
            <div className="flex items-baseline justify-between gap-4 px-7 pt-7 pb-5">
              <h3 className="text-[28px] font-bold">{plan.name}</h3>
              <p className="font-heading text-[clamp(40px,4vw,56px)] leading-none font-bold">Free</p>
            </div>
            <div className="px-7 pb-7">
              <SquareList bullet={plan.bullet} items={plan.items} />
            </div>
            <Link to={cta.to} className="flex h-16 items-center justify-between bg-foreground/8 px-7 font-semibold hover:bg-foreground/15">
              {cta.label} <ArrowRight className="size-5" aria-hidden />
            </Link>
          </div>
        ))}
      </div>
      <p className="reveal mt-8 max-w-[44em] text-muted-foreground">
        Hosting more than 2 contests in a month will use credits: 1 for ₹99, 5 for ₹449 or 10 for ₹799. Credit packs
        arrive with payments, and credits never expire.
      </p>
    </section>
  )
}
