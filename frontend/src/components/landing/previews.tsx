// Still pictures of the product for the landing page, built from markup so
// they follow the theme. Sample data only; nothing here is live.
import type { ReactNode } from 'react'
import { Mic, MonitorUp, PhoneOff, Play, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

const FRAME = 'overflow-hidden rounded-lg border bg-card text-left text-sm text-card-foreground'
const BAR = 'flex flex-wrap items-center gap-2.5 border-b px-3.5 py-2.5'

function Chip({ children, tone }: { children: ReactNode; tone?: 'fruit' | 'stem' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tone === 'fruit' ? 'bg-fruit text-fruit-ink' : tone === 'stem' ? 'bg-stem text-cream' : 'bg-muted',
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
        you ? 'bg-fruit text-fruit-ink' : 'bg-stem text-cream',
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
        'relative grid min-h-24 place-items-center rounded-lg bg-night-soft text-night-ink md:min-h-28',
        talking && 'ring-2 ring-fruit ring-inset',
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
    <div data-ui role="img" aria-label="An interview room: video call, code editor and chat with a pinned question" className={FRAME}>
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
            <span className="ml-auto inline-flex h-6 items-center gap-1 rounded-md bg-stem px-2.5 text-xs font-semibold text-cream">
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
          <div className="rounded-lg bg-fruit p-2.5 text-fruit-ink">
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
    <div data-ui role="img" aria-label="Written feedback from an AI practice interview, scored in five areas" className={FRAME}>
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
                  <i key={i} className={cn('h-2 flex-1 rounded-sm border', i <= score ? 'border-fruit bg-fruit' : 'bg-muted')} />
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
          <Chip tone="fruit">Next: a drill on edge cases</Chip>
        </span>
      </div>
    </div>
  )
}
