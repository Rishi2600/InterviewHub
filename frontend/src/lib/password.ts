// Mirrors the backend's src/auth/password-policy.ts.
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{10,64}$/

export const PASSWORD_HINT = '10 to 64 characters, with an uppercase letter, a lowercase letter and a special character.'

// bcrypt on the server ignores anything past 72 bytes.
const MAX_BYTES = 72

export function isValidPassword(value: string): boolean {
  return PASSWORD_PATTERN.test(value) && new TextEncoder().encode(value).length <= MAX_BYTES
}
