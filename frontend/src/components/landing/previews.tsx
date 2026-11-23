// Still pictures of the product for the landing page, built from markup so
// they follow the theme. Sample data only; nothing here is live.
import type { ReactNode } from 'react'
import { Mic, MonitorUp, PhoneOff, Play, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

const FRAME = 'overflow-hidden rounded-[10px] border bg-card text-left text-sm text-card-foreground'
const BAR = 'flex flex-wrap items-center gap-2.5 border-b px-3.5 py-2.5'

function Chip({ children, tone }: { children: ReactNode; tone?: 'gold' | 'crown' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tone === 'gold' ? 'bg-gold text-[#16241a]' : tone === 'crown' ? 'bg-crown text-cream' : 'bg-muted',
      )}
    >
      {children}
    </span>
  )
}

function Disc({ initials, you, className }: { initials: string; you?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold',
        you ? 'bg-gold text-[#16241a]' : 'bg-crown text-cream',
        className,
      )}
    >
      {initials}
    </span>
  )
}

// ── Interview room ───────────────────────────────────────────────────────────
const K = ({ children }: { children: ReactNode }) => <span className="font-semibold text-brand">{children}</span>
const N = ({ children }: { children: ReactNode }) => <span className="text-[var(--code-number)]">{children}</span>

const CODE: ReactNode[] = [
  <><K>function</K> twoSum(nums, target) {'{'}</>,
  <>  <K>const</K> seen = <K>new</K> Map()</>,
  <>  <K>for</K> (<K>let</K> i = <N>0</N>; i &lt; nums.length; i++) {'{'}</>,
  <>    <K>const</K> need = target - nums[i]</>,
  <>    <K>if</K> (seen.has(need)) <K>return</K> [seen.get(need), i]</>,
  <>    seen.set(nums[i], i)</>,
  <>  {'}'}</>,
  <>{'}'}</>,
]

function Tile({ initials, name, talking }: { initials: string; name: string; talking?: boolean }) {
  return (
    <div
      className={cn(
        'relative grid min-h-24 place-items-center rounded-lg bg-[#1f2d22] text-[#f4efdb] md:min-h-28',
        talking && 'ring-2 ring-gold ring-inset',
      )}
    >
      <Disc initials={initials} you={talking} className="size-[52px] text-[17px]" />
      <span className="absolute bottom-1.5 left-2 text-xs opacity-90">{name}</span>
    </div>
  )
}

export function RoomPreview() {
  const control = 'grid size-8 place-items-center rounded-full bg-muted [&_svg]:size-4'
  return (
    <div role="img" aria-label="An interview room: video call, code editor and chat with a pinned question" className={FRAME}>
      <div className={BAR}>
        <span className="size-2 shrink-0 rounded-full bg-[#e5484d]" />
        <b className="font-semibold">Frontend round</b>
        <Chip>Code K7P3Q</Chip>
        <span className="ml-auto text-muted-foreground tabular-nums">24:12</span>
      </div>
      <div className="grid md:min-h-[360px] md:grid-cols-[0.95fr_1.5fr_1fr]">
        <div className="grid grid-cols-2 gap-2 border-b p-2.5 md:grid-cols-1 md:grid-rows-[1fr_1fr_auto] md:border-r md:border-b-0">
          <Tile initials="MK" name="meera.k · interviewer" />
          <Tile initials="SR" name="sam.r" talking />
          <div className="col-span-2 flex justify-center gap-1.5 md:col-span-1">
            <span className={control}><Mic /></span>
            <span className={control}><Video /></span>
            <span className={control}><MonitorUp /></span>
            <span className={cn(control, 'w-11 rounded-2xl bg-[#e5484d] text-white')}><PhoneOff /></span>
          </div>
        </div>
        <div className="grid min-w-0 grid-rows-[auto_1fr_auto] bg-muted/60">
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <b className="font-semibold">solution.js</b>
            <Chip>JavaScript</Chip>
            <span className="ml-auto inline-flex h-6 items-center gap-1 rounded-md bg-crown px-2.5 text-xs font-semibold text-cream">
              <Play className="size-3" /> Run
            </span>
          </div>
          <pre className="overflow-hidden px-3.5 py-3 font-mono text-[12.5px] leading-[1.7]">
            <code>
              {CODE.map((line, i) => (
                <span key={i} className="block">
                  <span className="inline-block w-[1.6em] text-muted-foreground select-none">{i + 1}</span>
                  {line}
                </span>
              ))}
            </code>
          </pre>
          <pre className="border-t px-3.5 py-2 font-mono text-xs leading-relaxed">
            <code>
              &gt; twoSum([2, 7, 11, 15], 9){'\n'}
              <span className="text-brand">[0, 1]</span>  <span className="text-muted-foreground">3 ms</span>
            </code>
          </pre>
        </div>
        <div className="grid min-w-0 content-start gap-2.5 border-t p-2.5 text-[13px] md:border-t-0 md:border-l">
          <div className="rounded-lg bg-gold p-2.5 text-[#16241a]">
            <b className="block text-xs font-semibold">Pinned question</b>
            Return the indices of the two numbers that add up to target.
          </div>
          {[
            ['meera.k', 'Talk me through it before you run it.'],
            ['sam.r', "One pass: keep each number's index, look up target minus the number."],
            ['meera.k', 'Good. What if nothing adds up?'],
          ].map(([who, text], i) => (
            <p key={i} className="grid gap-0.5">
              <b className="text-xs font-semibold">{who}</b>
              {text}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Contest leaderboard ──────────────────────────────────────────────────────
const BOARD = [
  { rank: 1, name: 'lena.p', initials: 'LP', points: 400, time: '18:40' },
  { rank: 2, name: 'arjun_v', initials: 'AV', points: 400, time: '22:05' },
  { rank: 3, name: 'sam.r', initials: 'SR', points: 380, time: '19:12', you: true },
  { rank: 4, name: 'priya.n', initials: 'PN', points: 360, time: '25:30' },
  { rank: 5, name: 'tomas', initials: 'TO', points: 340, time: '27:44' },
]

export function LeaderboardPreview() {
  return (
    <div role="img" aria-label="A contest leaderboard: Arrays sprint, rated, 34 starters" className={FRAME}>
      <div className={BAR}>
        <b className="font-semibold">Arrays sprint</b>
        <Chip tone="crown">Rated</Chip>
        <span className="ml-auto text-muted-foreground">Ended 21 Nov · 34 starters</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-3.5 py-2 font-semibold">#</th>
            <th className="px-3.5 py-2 font-semibold">Name</th>
            <th className="px-3.5 py-2 text-right font-semibold">Points</th>
            <th className="hidden px-3.5 py-2 text-right font-semibold sm:table-cell">Time</th>
          </tr>
        </thead>
        <tbody>
          {BOARD.map((row) => (
            <tr key={row.rank} className={cn('border-b last:border-0', row.you && 'bg-gold/25')}>
              <td className="px-3.5 py-2.5">
                <span
                  className={cn(
                    'inline-grid size-6 place-items-center rounded-md text-xs font-bold',
                    row.rank === 1 ? 'bg-gold text-[#16241a]' : 'bg-muted',
                  )}
                >
                  {row.rank}
                </span>
              </td>
              <td className="px-3.5 py-2.5">
                <span className="flex items-center gap-2">
                  <Disc initials={row.initials} you={row.you} />
                  {row.name}
                  {row.you && <span className="text-muted-foreground">(you)</span>}
                </span>
              </td>
              <td className="px-3.5 py-2.5 text-right tabular-nums">{row.points}</td>
              <td className="hidden px-3.5 py-2.5 text-right text-muted-foreground tabular-nums sm:table-cell">{row.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Practice feedback ────────────────────────────────────────────────────────
const AREAS: [string, number][] = [
  ['Knowledge', 4],
  ['Problem solving', 4],
  ['Code quality', 3],
  ['Edge cases', 2],
  ['Communication', 5],
]

export function FeedbackPreview() {
  return (
    <div role="img" aria-label="Written feedback from an AI practice interview, scored in five areas" className={FRAME}>
      <div className={BAR}>
        <b className="font-semibold">Practice feedback</b>
        <Chip>JavaScript · Mid level · Voice</Chip>
        <span className="ml-auto text-muted-foreground">31 min</span>
      </div>
      <div className="grid gap-3.5 p-3.5">
        <div className="grid gap-2">
          {AREAS.map(([name, score]) => (
            <div key={name} className="grid grid-cols-[9.5em_1fr_2.4em] items-center gap-2.5 text-[13px]">
              <span>{name}</span>
              <span className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <i key={i} className={cn('h-2 flex-1 rounded-sm border', i <= score ? 'border-gold bg-gold' : 'bg-muted')} />
                ))}
              </span>
              <b className="font-semibold tabular-nums">{score}/5</b>
            </div>
          ))}
        </div>
        <p className="grid gap-0.5 text-[13px]">
          <b className="text-xs font-semibold text-muted-foreground">Went well</b>
          You compared a map with sorting before writing any code.
        </p>
        <p className="grid gap-0.5 text-[13px]">
          <b className="text-xs font-semibold text-muted-foreground">To work on</b>
          Edge cases: an empty array only came up when you were asked.
        </p>
        <span>
          <Chip tone="gold">Next: a drill on edge cases</Chip>
        </span>
      </div>
    </div>
  )
}
