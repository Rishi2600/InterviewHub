import { isValidPassword } from './password-policy';

describe('isValidPassword', () => {
  it('accepts a password that meets every rule', () => {
    expect(isValidPassword('Quiet-river9')).toBe(true);
    expect(isValidPassword('Aa!' + 'x'.repeat(61))).toBe(true);
  });

  it.each([
    ['too short', 'Ab!defgh1'],
    ['too long', 'Aa!' + 'x'.repeat(62)],
    ['no uppercase', 'quiet-river9'],
    ['no lowercase', 'QUIET-RIVER9'],
    ['no special character', 'QuietRiver9'],
    ['over 72 bytes', 'Aa!' + 'é'.repeat(40)],
    ['not a string', 12345678901],
  ])('rejects a password that is %s', (_, value) => {
    expect(isValidPassword(value)).toBe(false);
  });
});
