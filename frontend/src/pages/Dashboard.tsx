import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Clock, LogIn, Plus, Trophy, Video } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/States'
import { Badge } from '@/components/ui/Badge'
import { useAuth, useCanHost } from '@/hooks/useAuth'
import { createContest, createRoom, listContests, listRooms } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'

export function Dashboard() {
  const { user } = useAuth()
  const canHost = useCanHost()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [roomDialogOpen, setRoomDialogOpen] = useState(false)
  const [contestDialogOpen, setContestDialogOpen] = useState(false)
  const [roomTitle, setRoomTitle] = useState('')
  const [contestTitle, setContestTitle] = useState('')

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: listRooms,
    enabled: Boolean(user),
  })

  const contestsQuery = useQuery({
    queryKey: ['contests'],
    queryFn: () => listContests(),
    enabled: Boolean(user),
  })

  const roomMutation = useMutation({
    mutationFn: (title: string) => createRoom(title),
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
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
      void queryClient.invalidateQueries({ queryKey: ['contests'] })
      setContestDialogOpen(false)
      setContestTitle('')
      toast.success('Contest created')
      navigate(`/contests/${contest._id}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not create the contest')),
  })

  const rooms = roomsQuery.data ?? []
  const contests = contestsQuery.data ?? []

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

      {/* Your rooms and contests, straight from the backend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Your rooms"
            description="Rooms you own or have joined."
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
              {rooms.map((room) => (
                <ListRow
                  key={room._id}
                  title={room.title}
                  timestamp={room.updatedAt}
                  badge={room.code}
                  to={`/rooms/${room._id}`}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Your contests"
            description="Contests you own or have joined."
          />
          {contests.length === 0 ? (
            <EmptyState
              icon={<Trophy className="size-6" />}
              title="No contests yet"
              description={
                canHost
                  ? 'Create a contest to start scoring participants live.'
                  : 'Contests you join will be listed here for quick access.'
              }
              className="border-0 py-8"
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {contests.map((contest) => (
                <ListRow
                  key={contest._id}
                  title={contest.title}
                  timestamp={contest.createdAt}
                  badge={contest.state}
                  to={`/contests/${contest._id}`}
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

function ListRow({
  title,
  timestamp,
  badge,
  to,
}: {
  title: string
  timestamp: string
  badge?: string
  to: string
}) {
  return (
    <li className="group flex items-center gap-2 rounded-[var(--radius-control)] transition-colors hover:bg-surface-raised">
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body text-ink">{title}</p>
          <p className="flex items-center gap-1 text-micro text-ink-faint">
            <Clock className="size-3" aria-hidden />
            {formatDateTime(timestamp)}
          </p>
        </div>
        {badge && <Badge tone="neutral" className="font-mono">{badge}</Badge>}
      </Link>
    </li>
  )
}