import { describe, expect, it } from 'vitest'
import { isValidPassword } from './password'

describe('isValidPassword', () => {
  it('accepts a password that meets every rule', () => {
    expect(isValidPassword('Quiet-river9')).toBe(true)
  })

  it('rejects passwords that break a rule', () => {
    expect(isValidPassword('Ab!defgh1')).toBe(false) // too short
    expect(isValidPassword('Aa!' + 'x'.repeat(62))).toBe(false) // too long
    expect(isValidPassword('quiet-river9')).toBe(false) // no uppercase
    expect(isValidPassword('QUIET-RIVER9')).toBe(false) // no lowercase
    expect(isValidPassword('QuietRiver9')).toBe(false) // no special character
    expect(isValidPassword('Aa!' + 'é'.repeat(40))).toBe(false) // over 72 bytes
  })
})
