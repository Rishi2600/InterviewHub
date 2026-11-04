// The signed-in navigation, in one place, so the sidebar and the command
// menu always list the same pages.
import { LayoutDashboard, LogIn, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Join a room', href: '/rooms/join', icon: LogIn },
  { label: 'Profile', href: '/profile', icon: UserRound },
]

/** "/" matches only itself; other items also match their sub-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere. */
export const SEARCH_SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'
