import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AtSign, KeyRound } from 'lucide-react'
import { Button } from '@/components/legacy/Button'
import { Input } from '@/components/legacy/Input'
import { useAuth } from '@/hooks/useAuth'
import { errorMessage } from '@/lib/api'
import { AuthLayout } from './AuthLayout'

// Mirrors the backend LoginDto.
const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormValues = z.infer<typeof schema>

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setFormError(null)
    try {
      await login(values.email, values.password)
      navigate(from, { replace: true })
    } catch (err) {
      setFormError(errorMessage(err, 'Could not sign you in'))
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to run interviews, join rooms and follow live contests."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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
          autoComplete="current-password"
          placeholder="••••••••"
          leadingIcon={<KeyRound className="size-4" />}
          error={errors.password?.message}
        />

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
          Sign in
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-5 text-caption text-ink-faint">
        New here?{' '}
        <Link to="/register" className="text-sand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}