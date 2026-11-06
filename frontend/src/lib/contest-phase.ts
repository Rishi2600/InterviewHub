import type { Contest, ContestPhase } from '@/types'

/**
 * The phase as of `now`, so a page moves from upcoming to live to pending
 * on time without a reload. Only the server knows when results are out, so
 * `ended` is taken from it.
 */
export function livePhase(
  c: { phase: ContestPhase; startAt: string | null; endAt: string | null },
  now: number,
): ContestPhase {
  if (c.phase === 'draft' || c.phase === 'cancelled' || c.phase === 'ended') return c.phase
  if (!c.startAt || !c.endAt) return c.phase
  if (now < new Date(c.startAt).getTime()) return 'upcoming'
  if (now < new Date(c.endAt).getTime()) return 'live'
  return 'pending'
}

/** The phase of a stored contest (lists of your own contests). */
export function phaseOfContest(c: Contest, now: number): ContestPhase {
  if (c.status !== 'published') return c.status
  return livePhase({ phase: c.finalizedAt ? 'ended' : 'upcoming', startAt: c.startAt, endAt: c.endAt }, now)
}
