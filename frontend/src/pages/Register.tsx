import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AtSign, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { AuthLayout } from './AuthLayout'
import type { Role } from '@/types'

// Mirrors the backend RegisterDto: username min 2, password min 6, optional role.
const schema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['candidate', 'interviewer']),
})

type FormValues = z.infer<typeof schema>

/** Self-service signup offers the two non-privileged roles; `admin` is not
 *  something a user may claim for themselves. */
type SignupRole = Extract<Role, 'candidate' | 'interviewer'>

const ROLES: Array<{ value: SignupRole; label: string; blurb: string }> = [
  { value: 'candidate', label: 'Candidate', blurb: 'Join rooms and compete' },
  { value: 'interviewer', label: 'Interviewer', blurb: 'Create rooms and score' },
]

export function Register() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'candidate' },
  })

  const selectedRole = useWatch({ control, name: 'role' })

  async function onSubmit(values: FormValues) {
    setFormError(null)
    try {
      await registerUser(values)
      // Registration returns a token, so the user is signed in immediately.
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(errorMessage(err, 'Could not create your account'))
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One account for interview rooms, live chat and scored contests."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          {...register('username')}
          label="Username"
          autoComplete="username"
          placeholder="Ada Lovelace"
          error={errors.username?.message}
        />

        <Input
          {...register('email')}
          type="email"
          label="Email"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={<AtSign className="size-4" />}
          error={errors.email?.message}
        />

        <Input
          {...register('password')}
          type="password"
          label="Password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          leadingIcon={<KeyRound className="size-4" />}
          error={errors.password?.message}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">I'm signing up as</legend>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((role) => {
              const isSelected = selectedRole === role.value
              return (
                <button
                  key={role.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setValue('role', role.value, { shouldValidate: true })}
                  className={cn(
                    'rounded-[var(--radius-control)] border px-3 py-2.5 text-left',
                    'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-peaks)]',
                    isSelected
                      ? 'border-line-strong bg-raised'
                      : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span className={cn('block text-caption', isSelected ? 'text-ink' : 'text-ink-muted')}>
                    {role.label}
                  </span>
                  <span className="block text-micro text-ink-faint">{role.blurb}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {formError && (
          <p
            role="alert"
            className="border-l-2 border-clay bg-surface px-3 py-2 text-caption text-ink"
          >
            {formError}
          </p>
        )}

        {/* The one primary action on this screen. */}
        <Button type="submit" size="lg" fullWidth isLoading={isSubmitting} className="mt-2">
          Create account
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-5 text-caption text-ink-faint">
        Already have an account?{' '}
        <Link to="/login" className="text-sand hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}