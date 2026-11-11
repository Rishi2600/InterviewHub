// The signed-in navigation, in one place, so the sidebar and the command
// menu always list the same pages.
import { Bot, LayoutDashboard, LogIn, Trophy, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from '@/types'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Only these roles see it; everyone when unset. */
  roles?: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Contests', href: '/contests', icon: Trophy },
  { label: 'AI practice', href: '/practice', icon: Bot, roles: ['candidate'] },
  { label: 'Join a room', href: '/rooms/join', icon: LogIn },
  { label: 'Profile', href: '/profile', icon: UserRound },
]

/** The items a user with this role sees. */
export function navFor(role: Role | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)))
}

/** "/" matches only itself; other items also match their sub-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. */
export const SEARCH_SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
