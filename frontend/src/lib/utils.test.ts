import { describe, expect, it } from 'vitest'
import { cn, initials, timeAgo } from './utils'

describe('utils', () => {
  it('cn lets later Tailwind classes win', () => {
    expect(cn('px-2 text-sm', false, 'px-4')).toBe('text-sm px-4')
  })

  it('initials takes the first and last name', () => {
    expect(initials('Ada Okafor')).toBe('AO')
    expect(initials('Priya Devi Raman')).toBe('PR')
    expect(initials('plato')).toBe('PL')
    expect(initials('  ')).toBe('?')
  })

  it('timeAgo reads naturally', () => {
    const now = new Date('2026-11-04T18:00:00Z').getTime()
    expect(timeAgo('2026-11-04T17:59:40Z', now)).toBe('Just now')
    expect(timeAgo('2026-11-04T17:46:00Z', now)).toBe('14 min ago')
    expect(timeAgo('2026-11-04T15:00:00Z', now)).toBe('3 h ago')
    expect(timeAgo('2026-11-03T12:00:00Z', now)).toBe('Yesterday')
    expect(timeAgo('not a date', now)).toBe('')
  })
})
