import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DoorOpen, Moon, Sun, Trophy } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useLiveNow } from '@/hooks/useLiveNow'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/hooks/useAuth'
import { navFor } from './nav'

/** Ctrl/Cmd+K: jump to a page or a live room or contest. */
export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const live = useLiveNow()
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  function run(action: () => void) {
    onOpenChange(false)
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Jump to a page">
      <CommandInput placeholder="Search pages, rooms and contests" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Pages">
          {navFor(user?.role).map((item) => (
            <CommandItem key={item.href} onSelect={() => run(() => navigate(item.href))}>
              <item.icon aria-hidden />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {(live.rooms.length > 0 || live.contests.length > 0) && (
          <CommandGroup heading="Live now">
            {live.rooms.map((room) => (
              <CommandItem key={room._id} onSelect={() => run(() => navigate(`/rooms/${room._id}`))}>
                <DoorOpen aria-hidden />
                {room.title}
              </CommandItem>
            ))}
            {live.contests.map((contest) => (
              <CommandItem
                key={contest._id}
                onSelect={() => run(() => navigate(`/contests/${contest._id}`))}
              >
                <Trophy aria-hidden />
                {contest.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => run(toggleTheme)}>
            {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
