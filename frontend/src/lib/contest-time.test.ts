import { describe, expect, it } from 'vitest'
import { countdown, fromInputs, length, startsIn, toDateInput, toTimeInput } from './contest-time'
import { livePhase } from './contest-phase'

describe('contest times', () => {
  it('formats countdowns, never below zero', () => {
    expect(countdown(22 * 60_000 + 14_000)).toBe('22:14')
    expect(countdown(3600_000 + 19 * 60_000 + 42_000)).toBe('1:19:42')
    expect(countdown(-5000)).toBe('0:00')
  })

  it('says how long until a start', () => {
    expect(startsIn(15 * 60_000)).toBe('in 15 min')
    expect(startsIn(80 * 60_000)).toBe('in 1 h 20 min')
    expect(startsIn(23 * 3600_000)).toBe('in 23 h')
    expect(startsIn(3 * 24 * 3600_000)).toBe('in 3 days')
  })

  it('formats lengths', () => {
    expect(length(45)).toBe('45 min')
    expect(length(120)).toBe('2 h')
    expect(length(90)).toBe('1 h 30 min')
    expect(length(null)).toBe('–')
  })

  it('round-trips date and time inputs through an ISO instant', () => {
    const iso = fromInputs('2026-11-10', '19:30')!
    expect(toDateInput(iso)).toBe('2026-11-10')
    expect(toTimeInput(iso)).toBe('19:30')
    expect(fromInputs('2026-11-10', '')).toBeNull()
  })
})

describe('livePhase', () => {
  const contest = { phase: 'upcoming' as const, startAt: '2026-11-10T12:00:00Z', endAt: '2026-11-10T12:30:00Z' }
  const at = (iso: string) => livePhase(contest, new Date(iso).getTime())

  it('moves from upcoming to live to pending with the clock', () => {
    expect(at('2026-11-10T11:59:59Z')).toBe('upcoming')
    expect(at('2026-11-10T12:00:00Z')).toBe('live')
    expect(at('2026-11-10T12:30:00Z')).toBe('pending')
  })

  it('trusts the server for ended, drafts and cancelled contests', () => {
    const now = new Date('2026-11-10T12:10:00Z').getTime()
    expect(livePhase({ ...contest, phase: 'ended' }, now)).toBe('ended')
    expect(livePhase({ ...contest, phase: 'cancelled' }, now)).toBe('cancelled')
  })
})
