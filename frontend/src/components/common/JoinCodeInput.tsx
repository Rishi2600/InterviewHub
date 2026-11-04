import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { cn } from '@/lib/utils'

export const JOIN_CODE_LENGTH = 5
/** The backend's join-code alphabet leaves out I, O, 0 and 1. Lowercase is
 *  accepted while typing and upper-cased on change. */
const PATTERN = '^[A-HJ-NP-Za-hj-np-z2-9]+$'

/** Five boxes for a room's join code. */
export function JoinCodeInput({
  value,
  onChange,
  size = 'md',
  autoFocus,
  invalid,
}: {
  value: string
  onChange: (code: string) => void
  size?: 'md' | 'lg'
  autoFocus?: boolean
  invalid?: boolean
}) {
  return (
    <InputOTP
      maxLength={JOIN_CODE_LENGTH}
      pattern={PATTERN}
      value={value}
      onChange={(v) => onChange(v.toUpperCase())}
      autoFocus={autoFocus}
      aria-label="Join code"
      aria-invalid={invalid || undefined}
    >
      <InputOTPGroup>
        {Array.from({ length: JOIN_CODE_LENGTH }, (_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className={cn('font-mono', size === 'lg' ? 'size-14 text-xl' : 'size-11 text-base')}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
