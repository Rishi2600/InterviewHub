import { describe, expect, it } from 'vitest'
import { buildGraph, canSeeScore, describeKinds, formatChange } from './score'

describe('buildGraph', () => {
  it('lays days out in Sunday-first week columns', () => {
    // Sun 1 Nov to Sat 14 Nov 2026: two full weeks.
    const g = buildGraph('2026-11-01', '2026-11-14', [])
    expect(g.weeks).toHaveLength(2)
    expect(g.weeks[0][0]?.date).toBe('2026-11-01')
    expect(g.weeks[1][6]?.date).toBe('2026-11-14')
  })

  it('leaves days outside the range empty', () => {
    // Wed 4 Nov to Mon 9 Nov.
    const g = buildGraph('2026-11-04', '2026-11-09', [])
    expect(g.weeks[0].slice(0, 3)).toEqual([null, null, null])
    expect(g.weeks[0][3]?.date).toBe('2026-11-04')
    expect(g.weeks[1].slice(2)).toEqual([null, null, null, null, null])
  })

  it('puts counts on their day and caps the level at 4', () => {
    const g = buildGraph('2026-11-01', '2026-11-07', [
      { date: '2026-11-02', count: 1 },
      { date: '2026-11-05', count: 9 },
    ])
    expect(g.weeks[0].map((c) => c?.level)).toEqual([0, 1, 0, 0, 4, 0, 0])
    expect(g.weeks[0][4]?.count).toBe(9)
  })

  it('labels each month on its first week, skipping one with no room', () => {
    const g = buildGraph('2025-11-08', '2026-11-07', [])
    expect(g.weeks).toHaveLength(53)
    expect(g.months[0]).toEqual({ label: 'Nov', week: 0 })
    expect(g.months.map((m) => m.label)).toContain('Dec')
    // November 2026 starts in the last column, so it gets no label.
    expect(g.months.at(-1)?.label).toBe('Oct')
  })
})

describe('formatChange', () => {
  it('signs the change and never shows −0.0', () => {
    expect(formatChange(0.34)).toBe('+0.3')
    expect(formatChange(-0.25)).toBe('−0.2')
    expect(formatChange(-0.04)).toBe('±0.0')
  })
})

describe('canSeeScore', () => {
  it('lets the candidate, interviewers and admins in', () => {
    expect(canSeeScore({ id: 'a', role: 'candidate' }, 'a')).toBe(true)
    expect(canSeeScore({ id: 'b', role: 'candidate' }, 'a')).toBe(false)
    expect(canSeeScore({ id: 'b', role: 'interviewer' }, 'a')).toBe(true)
    expect(canSeeScore({ id: 'b', role: 'admin' }, 'a')).toBe(true)
    expect(canSeeScore(null, 'a')).toBe(false)
  })
})

describe('describeKinds', () => {
  it('names each kind of activity on a day, in a fixed order', () => {
    expect(describeKinds({ prep: 2, contest: 1 })).toBe('1 contest, 2 prep sessions')
    expect(describeKinds({ dummy: 1, interview: 1 })).toBe('1 live interview, 1 practice interview')
    expect(describeKinds(undefined)).toBe('')
  })
})
