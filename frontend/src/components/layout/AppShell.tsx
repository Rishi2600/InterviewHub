import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { DoorOpen, LayoutGrid, LogOut, Mountain, User as UserIcon } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge } from '@/components/ui/Badge'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/**
 * Two groups, always in this order. PEAKS is the live, competitive surface;
 * BASELINE is the everyday layer underneath it. New screens join one of the
 * two -- there is no third group.
 */
const PEAKS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/rooms/join', label: 'Interview rooms', icon: DoorOpen },
]

const BASELINE: NavItem[] = [{ to: '/profile', label: 'Profile', icon: UserIcon }]

/** Active is the only place sand appears in the nav. */
function itemClass(isActive: boolean): string {
  return cn(
    'group relative flex items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2',
    'text-caption transition-colors duration-[var(--duration-fast)] ease-[var(--ease-peaks)]',
    'bar:justify-center rail:justify-start',
    isActive ? 'bg-sand-soft text-sand' : 'text-ink-muted hover:bg-surface hover:text-ink',
  )
}

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div>
      <p className="label mb-2 px-2.5 hidden rail:block">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {items.map(({ to, label: text, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => itemClass(isActive)}>
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-[var(--radius-pill)]',
                      isActive ? 'bg-sand' : 'bg-transparent',
                    )}
                  />
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="hidden truncate rail:inline">{text}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const allItems = [...PEAKS, ...BASELINE]

  return (
    <div className="min-h-screen bg-ground">
      {/* Left rail: full at >=1180, icons only from 820, hidden below. */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-ground',
          'bar:flex bar:w-14 rail:w-[var(--container-rail)]',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-3 rail:px-4">
          <Mountain className="size-4 shrink-0 text-sand" aria-hidden />
          <span className="hidden display-tight text-subheading text-ink rail:inline">
            InterviewHub
          </span>
        </div>

        <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-2 py-5">
          <NavGroup label="Peaks" items={PEAKS} />
          <NavGroup label="Baseline" items={BASELINE} />
        </nav>

        {user && (
          <div className="border-t border-line px-2 py-3">
            <div className="flex items-center gap-2.5 px-1 py-1.5">
              <Avatar name={user.username} id={user.id} src={user.avatarUrl} size="sm" />
              <div className="hidden min-w-0 flex-1 rail:block">
                <p className="truncate text-micro text-ink">{user.username}</p>
                <RoleBadge role={user.role} />
              </div>
            </div>
            <button
              onClick={handleLogout}
              className={cn(
                'mt-1 flex w-full items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2',
                'text-caption text-ink-muted transition-colors duration-[var(--duration-fast)]',
                'hover:bg-surface hover:text-ink bar:justify-center rail:justify-start',
              )}
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              <span className="hidden rail:inline">Log out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Bottom bar under 820. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-ground bar:hidden"
      >
        {allItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.625rem]',
                'transition-colors duration-[var(--duration-fast)]',
                isActive ? 'text-sand' : 'text-ink-muted',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            <span className="truncate px-1">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.625rem] text-ink-muted"
        >
          <LogOut className="size-4" aria-hidden />
          Log out
        </button>
      </nav>

      <main
        className={cn(
          'pb-20 bar:pb-0 bar:pl-14 rail:pl-[var(--container-rail)]',
        )}
      >
        <div className="mx-auto max-w-[var(--container-content)] px-gutter py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
