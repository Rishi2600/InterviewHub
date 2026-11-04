import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronsUpDown, LogOut, MessagesSquare, Moon, Search, Sun, UserRound } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import { UserAvatar } from '@/components/common/UserAvatar'
import { LiveDot } from '@/components/common/LiveDot'
import { useAuth } from '@/hooks/useAuth'
import { useLiveNow } from '@/hooks/useLiveNow'
import { useTheme } from '@/hooks/use-theme'
import { NAV_ITEMS, SEARCH_SHORTCUT, isActivePath } from './nav'

const ROLE_LABEL = { candidate: 'Candidate', interviewer: 'Interviewer', admin: 'Admin' } as const

/** Brand, navigation, live sessions and the user menu. Collapses to icons,
 *  and becomes a sheet on phones. */
export function AppSidebar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const live = useLiveNow()
  const { theme, toggleTheme } = useTheme()

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  const hasLive = live.rooms.length > 0 || live.contests.length > 0

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessagesSquare className="size-4" aria-hidden />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-heading text-sm font-semibold">InterviewHub</span>
                  <span className="truncate text-xs text-muted-foreground">Interviews and contests</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild tooltip={item.label} isActive={isActivePath(pathname, item.href)}>
                    <Link to={item.href}>
                      <item.icon aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={`Search (${SEARCH_SHORTCUT})`} onClick={onOpenSearch}>
                  <Search aria-hidden />
                  <span>Search</span>
                  <Kbd className="ml-auto">{SEARCH_SHORTCUT}</Kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasLive && (
          <SidebarGroup>
            <SidebarGroupLabel>Live now</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {live.rooms.map((room) => (
                  <SidebarMenuItem key={room._id}>
                    <SidebarMenuButton
                      asChild
                      tooltip={room.title}
                      isActive={pathname === `/rooms/${room._id}`}
                    >
                      <Link to={`/rooms/${room._id}`}>
                        <LiveDot className="mx-1" />
                        <span>{room.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {live.contests.map((contest) => (
                  <SidebarMenuItem key={contest._id}>
                    <SidebarMenuButton
                      asChild
                      tooltip={contest.title}
                      isActive={pathname === `/contests/${contest._id}`}
                    >
                      <Link to={`/contests/${contest._id}`}>
                        <LiveDot className="mx-1" />
                        <span>{contest.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {user && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={user.username}
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <UserAvatar name={user.username} src={user.avatarUrl} className="rounded-lg" />
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">{user.username}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto" aria-hidden />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="grid leading-tight">
                      <span className="truncate text-sm font-medium">{user.username}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {ROLE_LABEL[user.role]}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/profile')}>
                    <UserRound aria-hidden />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={toggleTheme}>
                    {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
                    {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={signOut}>
                    <LogOut aria-hidden />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
