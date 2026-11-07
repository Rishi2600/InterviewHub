import { useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, CheckCheck, ChevronsUp, Flag, Flame, Medal, Trophy } from 'lucide-react'
import { BADGE_INFO, formatDay } from '@/lib/score'
import type { BadgeId, BadgeState } from '@/types'

const ICONS: Record<BadgeId, LucideIcon> = {
  'first-rated': Flag,
  winner: Trophy,
  podium: Medal,
  'top-10': ChevronsUp,
  finisher: CheckCheck,
  regular: CalendarCheck,
  streak: Flame,
}

const HEX = 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z'

/** One badge as a hexagon: filled in its colour when earned, dashed when not. */
export function BadgeHex({ badge, size = 52 }: { badge: BadgeState; size?: number }) {
  const gradient = useId()
  const { hue } = BADGE_INFO[badge.id]
  const Icon = ICONS[badge.id]
  const earned = badge.count > 0
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={hue} stopOpacity={0.85} />
            <stop offset="1" stopColor={hue} />
          </linearGradient>
        </defs>
        {earned ? (
          <>
            <path d={HEX} fill={`url(#${gradient})`} />
            <path d={HEX} fill="none" stroke="white" strokeOpacity={0.35} strokeWidth={3} transform="translate(50 50) scale(.82) translate(-50 -50)" />
          </>
        ) : (
          <path d={HEX} fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray="6 5" className="text-muted-foreground/50" />
        )}
      </svg>
      <Icon className={earned ? 'relative text-white' : 'relative text-muted-foreground'} style={{ width: size * 0.4, height: size * 0.4 }} aria-hidden />
    </span>
  )
}

/** Every badge in a row, with its name, and progress while locked. */
export function BadgeShelf({ badges }: { badges: BadgeState[] }) {
  if (badges.length === 0) return <p className="text-sm text-muted-foreground">No badges yet.</p>
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-4">
      {badges.map((b) => {
        const info = BADGE_INFO[b.id]
        const earned = b.count > 0
        const title = earned ? `${info.rule}. Earned ${formatDay(b.earnedAt!)}.` : `${info.rule}. ${b.progress} of ${b.goal}.`
        return (
          <li key={b.id} className="grid w-[4.5rem] justify-items-center gap-1 text-center" title={title}>
            <span className="relative">
              <BadgeHex badge={b} />
              {b.count > 1 && (
                <span className="absolute -right-1.5 -bottom-1 rounded-full border bg-card px-1 text-[10px] font-semibold tabular-nums">
                  {b.count}
                </span>
              )}
            </span>
            <span className={earned ? 'text-xs leading-tight font-medium' : 'text-xs leading-tight text-muted-foreground'}>{info.name}</span>
            <span className="sr-only">{title}</span>
            {!earned && (
              <span className="text-[11px] text-muted-foreground tabular-nums" aria-hidden>
                {b.progress}/{b.goal}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
