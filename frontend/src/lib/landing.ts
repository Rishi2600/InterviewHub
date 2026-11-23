// Shared pieces of the landing page: button classes, stagger and sample data.
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/** Square buttons, as on the rest of the landing page. */
export const BTN =
  'inline-flex h-[52px] items-center justify-center gap-2.5 rounded-lg px-6 text-[17px] font-semibold whitespace-nowrap transition active:translate-y-px'
export const BTN_GOLD = cn(BTN, 'bg-fruit text-fruit-ink hover:bg-fruit-deep')
export const BTN_SOFT = cn(BTN, 'bg-foreground/8 hover:bg-foreground/14')

/** Stagger index for a .reveal element. */
export const at = (i: number) => ({ '--i': i }) as CSSProperties

/** Sample activity, busier towards the present: 0 (none) to 4 (most) per day. */
export function activityLevels(weeks: number, seed: number): number[] {
  let s = seed
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
  const out: number[] = []
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const busy = 0.25 + 0.6 * (w / weeks)
      const x = rnd()
      out.push(x > busy ? 0 : x < busy * 0.15 ? 4 : x < busy * 0.35 ? 3 : x < busy * 0.65 ? 2 : 1)
    }
  }
  return out
}
