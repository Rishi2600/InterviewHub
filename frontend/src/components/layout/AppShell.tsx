import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Radio, Trophy, User as UserIcon, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: Radio, end: true },
  { to: '/rooms/join', label: 'Join room', icon: Trophy, end: false },
  { to: '/profile', label: 'Profile', icon: UserIcon, end: false },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-ground">
      <header className="sticky top-0 z-40 border-b border-line bg-ground/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden
              className="grid size-7 place-items-center rounded-[var(--radius-control)] bg-accent text-accent-ink"
            >
              <Radio className="size-4" />
            </span>
            <span className="text-subheading font-semibold tracking-tight">InterviewHub</span>
          </Link>

          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'rounded-[var(--radius-control)] px-3 py-1.5 text-caption font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-surface-raised text-ink'
                      : 'text-ink-muted hover:bg-surface hover:text-ink',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <div className="hidden items-center gap-2.5 sm:flex">
                <Avatar name={user.username} id={user.id} src={user.avatarUrl} size="sm" />
                <div className="leading-tight">
                  <p className="text-caption font-medium text-ink">{user.username}</p>
                  <RoleBadge role={user.role} />
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              leadingIcon={<LogOut className="size-3.5" />}
              className="hidden sm:inline-flex"
            >
              Log out
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <Menu className="size-4" /> : <X className="size-4" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            aria-label="Mobile"
            className="animate-rise border-t border-line bg-surface px-4 py-2 md:hidden"
          >
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-body',
                    isActive ? 'bg-surface-raised text-ink' : 'text-ink-muted',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-left text-body text-ink-muted"
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}