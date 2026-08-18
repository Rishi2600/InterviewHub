import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Clock, LogIn, Plus, Trophy, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/States'
import { Badge } from '@/components/ui/Badge'
import { useAuth, useCanHost } from '@/hooks/useAuth'
import { createContest, createRoom } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { forgetRecent, getRecents, rememberRecent } from '@/lib/recents'
import type { RecentItem } from '@/lib/recents'
import { formatDateTime } from '@/lib/utils'

export function Dashboard() {
  const { user } = useAuth()
  const canHost = useCanHost()
  const navigate = useNavigate()

  const [recents, setRecents] = useState<RecentItem[]>([])
  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [contestDialogOpen, setContestDialogOpen] = useState(false)
  const [roomTitle, setRoomTitle] = useState('')
  const [contestTitle, setContestTitle] = useState('')

  useEffect(() => {
    if (user) setRecents(getRecents(user.id))
  }, [user])

  const remember = useCallback(
    (item: Omit<RecentItem, 'visitedAt'>) => {
      if (!user) return
      setRecents(rememberRecent(user.id, item))
    },
    [user],
  )

  const roomMutation = useMutation({
    mutationFn: (title: string) => createRoom(title),
    onSuccess: (room) => {
      remember({ kind: 'room', id: room._id, title: room.title, code: room.code })
      setRoomDialogOpen(false)
      setRoomTitle('')
      toast.success(`Room created — code ${room.code}`)
      navigate(`/rooms/${room._id}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not create the room')),
  })

  const contestMutation = useMutation({
    mutationFn: (title: string) => createContest(title),
    onSuccess: (contest) => {
      remember({ kind: 'contest', id: contest._id, title: contest.title })
      setContestDialogOpen(false)
      setContestTitle('')
      toast.success('Contest created')
      navigate(`/contests/${contest._id}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not create the contest')),
  })

  const rooms = recents.filter((r) => r.kind === 'room')
  const contests = recents.filter((r) => r.kind === 'contest')

  return (
    <div className="flex flex-col gap-6">
      <header className="animate-rise">
        <h1 className="text-display font-semibold text-ink">
          Hey {user?.username?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="mt-1 text-body text-ink-muted">
          {canHost
            ? 'Start an interview room or run a scored contest.'
            : 'Join a room with a code, or open a contest you were invited to.'}
        </p>
      </header>

      {/* Primary actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="flex flex-col justify-between gap-4">
          <div>
            <span
              aria-hidden
              className="mb-3 grid size-9 place-items-center rounded-[var(--radius-control)] bg-accent-soft text-accent"
            >
              <LogIn className="size-4" />
            </span>
            <h2 className="text-subheading font-semibold text-ink">Join a room</h2>
            <p className="mt-1 text-caption text-ink-muted">
              Enter the 5-character code an interviewer shared with you.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/rooms/join')} fullWidth>
            Enter a code
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </Card>

        {canHost && (
          <>
            <Card className="flex flex-col justify-between gap-4">
              <div>
                <span
                  aria-hidden
                  className="mb-3 grid size-9 place-items-center rounded-[var(--radius-control)] bg-accent-soft text-accent"
                >
                  <Video className="size-4" />
                </span>
                <h2 className="text-subheading font-semibold text-ink">New interview room</h2>
                <p className="mt-1 text-caption text-ink-muted">
                  Creates a room with a shareable join code and live chat.
                </p>
              </div>
              <Button onClick={() => setRoomDialogOpen(true)} fullWidth leadingIcon={<Plus className="size-4" />}>
                Create room
              </Button>
            </Card>

            <Card className="flex flex-col justify-between gap-4">
              <div>
                <span
                  aria-hidden
                  className="mb-3 grid size-9 place-items-center rounded-[var(--radius-control)] bg-accent-soft text-accent"
                >
                  <Trophy className="size-4" />
                </span>
                <h2 className="text-subheading font-semibold text-ink">New contest</h2>
                <p className="mt-1 text-caption text-ink-muted">
                  Score participants live on a leaderboard everyone can watch.
                </p>
              </div>
              <Button onClick={() => setContestDialogOpen(true)} fullWidth leadingIcon={<Plus className="size-4" />}>
                Create contest
              </Button>
            </Card>
          </>
        )}
      </div>

      {/* Recents */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent rooms"
            description="Rooms you've created or joined on this device."
          />
          {rooms.length === 0 ? (
            <EmptyState
              icon={<Video className="size-6" />}
              title="No rooms yet"
              description={
                canHost
                  ? 'Create a room to get a join code you can share.'
                  : 'Join a room with a code and it will show up here.'
              }
              className="border-0 py-8"
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {rooms.map((item) => (
                <RecentRow
                  key={item.id}
                  item={item}
                  to={`/rooms/${item.id}`}
                  onForget={() => {
                    if (user) setRecents(forgetRecent(user.id, 'room', item.id))
                  }}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent contests"
            description="Contests you've opened on this device."
          />
          {contests.length === 0 ? (
            <EmptyState
              icon={<Trophy className="size-6" />}
              title="No contests yet"
              description={
                canHost
                  ? 'Create a contest to start scoring participants live.'
                  : 'Contests you open will be listed here for quick access.'
              }
              className="border-0 py-8"
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {contests.map((item) => (
                <RecentRow
                  key={item.id}
                  item={item}
                  to={`/contests/${item.id}`}
                  onForget={() => {
                    if (user) setRecents(forgetRecent(user.id, 'contest', item.id))
                  }}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={roomDialogOpen}
        onClose={() => setRoomDialogOpen(false)}
        title="Create an interview room"
        description="You'll get a 5-character code to share with candidates."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoomDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => roomMutation.mutate(roomTitle.trim())}
              disabled={!roomTitle.trim()}
              isLoading={roomMutation.isPending}
            >
              Create room
            </Button>
          </>
        }
      >
        <Input
          label="Room title"
          value={roomTitle}
          autoFocus
          placeholder="Frontend interview — Ada"
          onChange={(e) => setRoomTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && roomTitle.trim()) roomMutation.mutate(roomTitle.trim())
          }}
        />
      </Dialog>

      <Dialog
        open={contestDialogOpen}
        onClose={() => setContestDialogOpen(false)}
        title="Create a contest"
        description="Starts in draft — activate it when you're ready to score."
        footer={
          <>
            <Button variant="ghost" onClick={() => setContestDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => contestMutation.mutate(contestTitle.trim())}
              disabled={!contestTitle.trim()}
              isLoading={contestMutation.isPending}
            >
              Create contest
            </Button>
          </>
        }
      >
        <Input
          label="Contest title"
          value={contestTitle}
          autoFocus
          placeholder="Algorithms sprint — round 1"
          onChange={(e) => setContestTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && contestTitle.trim())
              contestMutation.mutate(contestTitle.trim())
          }}
        />
      </Dialog>
    </div>
  )
}

function RecentRow({
  item,
  to,
  onForget,
}: {
  item: RecentItem
  to: string
  onForget: () => void
}) {
  return (
    <li className="group flex items-center gap-2 rounded-[var(--radius-control)] transition-colors hover:bg-surface-raised">
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body text-ink">{item.title}</p>
          <p className="flex items-center gap-1 text-micro text-ink-faint">
            <Clock className="size-3" aria-hidden />
            {formatDateTime(item.visitedAt)}
          </p>
        </div>
        {item.code && <Badge tone="neutral" className="font-mono">{item.code}</Badge>}
      </Link>
      <button
        onClick={onForget}
        aria-label={`Remove ${item.title} from recents`}
        className="mr-2 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  )
}