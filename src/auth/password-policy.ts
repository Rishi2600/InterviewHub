import { ValidateBy, ValidationOptions } from 'class-validator';

// 10 to 64 characters, with a lowercase letter, an uppercase letter and a
// special character (anything that is not a letter or digit).
export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{10,64}$/;

export const PASSWORD_RULES =
  'Password must be 10 to 64 characters and include an uppercase letter, a lowercase letter and a special character';

// bcrypt ignores everything past 72 bytes, so longer passwords would be
// silently truncated. 64 characters can exceed that with non-ASCII text.
const BCRYPT_MAX_BYTES = 72;

export function isValidPassword(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    PASSWORD_PATTERN.test(value) &&
    Buffer.byteLength(value, 'utf8') <= BCRYPT_MAX_BYTES
  );
}

/** Applies the password policy. Used where a password is set, not at login. */
export function IsValidPassword(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isValidPassword',
      validator: {
        validate: isValidPassword,
        defaultMessage: () => PASSWORD_RULES,
      },
    },
    options,
  );
}
