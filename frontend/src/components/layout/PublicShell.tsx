import { Link, Outlet, useLocation } from 'react-router-dom'
import { MessagesSquare, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from './AppShell'
import { FullPageLoader } from './FullPageLoader'

/** The frame for signed-out visitors on public pages: a slim top bar with
 *  sign in and create account. */
export function PublicShell() {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to="/contests" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessagesSquare className="size-4" aria-hidden />
            </span>
            <span className="font-heading text-sm font-semibold">InterviewHub</span>
          </Link>
          <nav className="hidden text-sm sm:flex">
            <Link to="/contests" className="font-medium">
              Contests
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Switch theme">
              {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login" state={{ from: pathname }}>
                Sign in
              </Link>
            </Button>
            <Button size="sm" className="hidden sm:inline-flex" asChild>
              <Link to="/register">Create account</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-24">
        <Outlet />
      </main>
    </div>
  )
}

/** Public pages: the app frame when signed in, the public frame when not. */
export function PublicOrAppShell() {
  const { isAuthenticated, isBootstrapping } = useAuth()
  if (isBootstrapping) return <FullPageLoader label="Loading…" />
  return isAuthenticated ? <AppShell /> : <PublicShell />
}
