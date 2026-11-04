import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Clock, Plus } from 'lucide-react'
import { Button } from '@/components/legacy/Button'
import { Section, SectionHeader } from '@/components/legacy/Section'
import { Dialog } from '@/components/legacy/Dialog'
import { Input } from '@/components/legacy/Input'
import { Badge } from '@/components/legacy/Badge'
import { useAuth, useCanHost } from '@/hooks/useAuth'
import { createContest, createRoom, listContests, listRooms } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/utils'
import type { Contest, Room } from '@/types'

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

  const liveContest = contests.find((c) => c.state === 'active')
  const liveRoom = rooms.find((r) => r.state === 'active')

  return (
    <div className="animate-rise">
      <header className="pb-8">
        <p className="label mb-3">Dashboard</p>
        <h1 className="text-display text-ink">
          {user?.username?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="mt-2 text-caption text-ink-muted">
          {canHost
            ? 'Start an interview room or run a scored contest.'
            : 'Join a room with a code, or open a contest you were invited to.'}
        </p>

        <dl className="mt-6 flex gap-8">
          <Stat label="Rooms" value={rooms.length} />
          <Stat label="Contests" value={contests.length} />
        </dl>
      </header>

      {/* The one hot surface, and the only gradient in the product. Never
          empty: it falls back to the next thing worth doing. */}
      <LiveBanner
        contest={liveContest}
        room={liveRoom}
        canHost={canHost}
        onCreateContest={() => setContestDialogOpen(true)}
      />

      <Section>
        <SectionHeader
          label="Start"
          title="Open a room or a contest"
          description="Rooms carry a 5-character join code. Contests score participants live."
        />
        <div className="flex flex-wrap gap-2">
          {canHost ? (
            <>
              {/* The single primary action on this screen. */}
              <Button onClick={() => setRoomDialogOpen(true)} leadingIcon={<Plus className="size-3.5" />}>
                Create room
              </Button>
              <Button
                variant="secondary"
                onClick={() => setContestDialogOpen(true)}
                leadingIcon={<Plus className="size-3.5" />}
              >
                Create contest
              </Button>
              <Button variant="ghost" onClick={() => navigate('/rooms/join')}>
                Enter a code
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate('/rooms/join')}>
              Enter a code
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          )}
        </div>
      </Section>

      <Section>
        <SectionHeader label="Rooms" title="Your rooms" description="Rooms you own or have joined." />
        {rooms.length === 0 ? (
          <Prompt
            text={
              canHost
                ? 'Nothing open yet. Create a room to get a join code you can share.'
                : 'Nothing open yet. Enter a code to join your first room.'
            }
          />
        ) : (
          <ul>
            {rooms.map((room) => (
              <ListRow
                key={room._id}
                title={room.title}
                timestamp={room.updatedAt}
                badge={room.code}
                badgeTone={room.state === 'active' ? 'live' : 'neutral'}
                to={`/rooms/${room._id}`}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section>
        <SectionHeader
          label="Contests"
          title="Your contests"
          description="Contests you own or have joined."
        />
        {contests.length === 0 ? (
          <Prompt
            text={
              canHost
                ? 'No contests yet. Create one to start scoring participants live.'
                : 'No contests yet. Contests you join will be listed here.'
            }
          />
        ) : (
          <ul>
            {contests.map((contest) => (
              <ListRow
                key={contest._id}
                title={contest.title}
                timestamp={contest.createdAt}
                badge={contest.state}
                badgeTone={contest.state === 'active' ? 'live' : 'neutral'}
                to={`/contests/${contest._id}`}
              />
            ))}
          </ul>
        )}
      </Section>

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

/** Every number is mono and tabular. */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="num mt-1.5 text-heading text-ink">{value}</dd>
    </div>
  )
}

/**
 * The live banner. Absence of a live contest is never rendered as a void --
 * it degrades to the next real thing: a live room, then an invitation to
 * start one.
 */
function LiveBanner({
  contest,
  room,
  canHost,
  onCreateContest,
}: {
  contest?: Contest
  room?: Room
  canHost: boolean
  onCreateContest: () => void
}) {
  const body = contest
    ? {
        label: 'Live now',
        title: contest.title,
        meta: 'Scoring is open',
        to: `/contests/${contest._id}`,
        cta: 'Open contest',
      }
    : room
      ? {
          label: 'In progress',
          title: room.title,
          meta: `Join code ${room.code}`,
          to: `/rooms/${room._id}`,
          cta: 'Open room',
        }
      : null

  return (
    <div className="gradient-live rounded-[var(--radius-container)] border border-line px-6 py-6">
      {body ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="label flex items-center gap-2 text-sand">
              <span
                aria-hidden
                className="size-1.5 rounded-[var(--radius-pill)] bg-sand animate-[var(--animate-live)]"
              />
              {body.label}
            </span>
            <p className="display-tight mt-3 truncate text-heading text-ink">{body.title}</p>
            <p className="num mt-1.5 text-micro text-ink-muted">{body.meta}</p>
          </div>
          <Link
            to={body.to}
            className="text-caption text-sand hover:underline"
          >
            {body.cta}
            <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Nothing live</p>
            <p className="display-tight mt-3 text-heading text-ink">
              {canHost ? 'Run the next contest' : 'Join a room to get started'}
            </p>
            <p className="mt-1.5 text-micro text-ink-muted">
              {canHost
                ? 'Contests score participants on a leaderboard everyone watches.'
                : 'Ask an interviewer for a 5-character join code.'}
            </p>
          </div>
          {canHost && (
            <button onClick={onCreateContest} className="text-caption text-sand hover:underline">
              Create contest
              <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Prompt({ text }: { text: string }) {
  return <p className="py-2 text-caption text-ink-faint">{text}</p>
}

function ListRow({
  title,
  timestamp,
  badge,
  badgeTone = 'neutral',
  to,
}: {
  title: string
  timestamp: string
  badge?: string
  badgeTone?: 'neutral' | 'live'
  to: string
}) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        to={to}
        className="flex items-center gap-4 px-1 py-3.5 transition-colors duration-[var(--duration-fast)] hover:bg-surface"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption text-ink">{title}</p>
          <p className="num mt-1 flex items-center gap-1.5 text-micro text-ink-faint">
            <Clock className="size-3" aria-hidden />
            {formatDateTime(timestamp)}
          </p>
        </div>
        {badge && (
          <Badge tone={badgeTone} dot={badgeTone === 'live'}>
            {badge}
          </Badge>
        )}
      </Link>
    </li>
  )
}
