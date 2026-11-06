import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/api'
import { PASSWORD_HINT, isValidPassword } from '@/lib/password'
import { AuthLayout } from './AuthLayout'
import { LIMITS } from '@/lib/limits'

// Mirrors the backend RegisterDto: username min 2, the password policy, optional role.
const schema = z.object({
  username: z
    .string()
    .trim()
    .min(LIMITS.username.min, `Username must be at least ${LIMITS.username.min} characters`)
    .max(LIMITS.username.max, `Username must be at most ${LIMITS.username.max} characters`),
  email: z.email('Enter a valid email address'),
  password: z.string().refine(isValidPassword, `Password must be ${PASSWORD_HINT.toLowerCase()}`),
  role: z.enum(['candidate', 'interviewer']),
})

type FormValues = z.infer<typeof schema>

/** Self-service signup offers the two non-privileged roles; nobody can make
 *  themselves an admin. */
const ROLES = [
  { value: 'candidate', label: 'Candidate', blurb: 'Join rooms and enter contests' },
  { value: 'interviewer', label: 'Interviewer', blurb: 'Create rooms and score contests' },
] as const

export function Register() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'candidate' } })

  async function onSubmit(values: FormValues) {
    setFormError(null)
    try {
      await registerUser(values)
      // Registration returns a token, so the user is signed in straight away.
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(errorMessage(err, 'Could not create your account'))
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="One account for interview rooms, chat and contests.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.username) || undefined}>
            <FieldLabel htmlFor="username">Name</FieldLabel>
            <Input
              id="username"
              autoComplete="name"
              placeholder="Ada Okafor"
              aria-invalid={Boolean(errors.username) || undefined}
              {...register('username')}
            />
            <FieldError errors={[errors.username]} />
          </Field>
          <Field data-invalid={Boolean(errors.email) || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email) || undefined}
              {...register('email')}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={Boolean(errors.password) || undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password) || undefined}
              {...register('password')}
            />
            <FieldDescription>{PASSWORD_HINT}</FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
          <FieldSet>
            <FieldLegend variant="label">I'm signing up as</FieldLegend>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid-cols-2">
                  {ROLES.map((role) => (
                    <FieldLabel key={role.value} htmlFor={`role-${role.value}`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>{role.label}</FieldTitle>
                          <FieldDescription>{role.blurb}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value={role.value} id={`role-${role.value}`} />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              )}
            />
          </FieldSet>
          {formError && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden />
              <AlertTitle>{formError}</AlertTitle>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </FieldGroup>
      </form>
    </AuthLayout>
  )
}
