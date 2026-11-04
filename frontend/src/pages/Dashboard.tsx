import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DoorOpen, Plus, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { MetricStrip } from '@/components/common/MetricStrip'
import { PageHeader } from '@/components/layout/PageHeader'
import { CreateDialog } from '@/components/dashboard/CreateDialog'
import { ContestsList } from '@/components/dashboard/ContestsList'
import { JoinWithCode } from '@/components/dashboard/JoinWithCode'
import { LiveContestCard } from '@/components/dashboard/LiveContestCard'
import { LiveRoomCard, NoLiveRoomCard } from '@/components/dashboard/LiveRoomCard'
import { RoomsTable } from '@/components/dashboard/RoomsTable'
import { useAuth, useCanHost } from '@/hooks/useAuth'
import { createContest, createRoom, getContestResults, listContests, listRooms } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const { user } = useAuth()
  const canHost = useCanHost()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState<'room' | 'contest' | null>(null)
  // Read once per visit; the greeting does not need to tick over live.
  const [now] = useState(() => new Date())

  const rooms = useQuery({ queryKey: ['rooms'], queryFn: listRooms, enabled: Boolean(user) }).data ?? []
  const contests =
    useQuery({ queryKey: ['contests'], queryFn: () => listContests(), enabled: Boolean(user) }).data ?? []

  const liveRoom = rooms.find((r) => r.state === 'active')
  const liveContest = contests.find((c) => c.state === 'active')
  const entrants = useQuery({
    queryKey: ['contest-entries', liveContest?._id],
    queryFn: () => getContestResults(liveContest!._id),
    enabled: Boolean(liveContest),
  }).data

  const roomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (room) => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
      setCreating(null)
      toast.success(`Room created. Join code ${room.code}`)
      navigate(`/rooms/${room._id}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not create the room')),
  })

  const contestMutation = useMutation({
    mutationFn: createContest,
    onSuccess: (contest) => {
      void queryClient.invalidateQueries({ queryKey: ['contests'] })
      setCreating(null)
      toast.success('Contest created')
      navigate(`/contests/${contest._id}`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not create the contest')),
  })

  const waiting = rooms.filter((r) => r.state === 'waiting').length
  const drafts = contests.filter((c) => c.state === 'draft').length
  const liveCount = rooms.filter((r) => r.state === 'active').length

  return (
    <>
      <PageHeader title={<span>Dashboard</span>}>
        {canHost ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setCreating('contest')}>
              <Trophy aria-hidden />
              <span className="hidden sm:inline">New contest</span>
            </Button>
            <Button size="sm" onClick={() => setCreating('room')}>
              <Plus aria-hidden />
              <span className="hidden sm:inline">New room</span>
            </Button>
          </>
        ) : (
          <Button size="sm" asChild>
            <Link to="/rooms/join">
              <DoorOpen aria-hidden />
              Join a room
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          {greeting(now.getHours())}, {user?.username.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <MetricStrip
        metrics={[
          { label: 'Rooms', value: rooms.length, note: `${waiting} waiting for a candidate` },
          {
            label: 'Live now',
            value: liveCount,
            note: liveRoom?.title ?? 'No interview running',
            accent: liveCount > 0,
          },
          { label: 'Contests', value: contests.length, note: `${drafts} still in draft` },
          {
            label: 'Entrants',
            value: entrants?.length ?? 0,
            note: liveContest ? 'In the active contest' : 'No contest running',
          },
        ]}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {liveRoom ? (
          <LiveRoomCard room={liveRoom} userId={user?.id} />
        ) : (
          <NoLiveRoomCard canHost={canHost} onCreate={() => setCreating('room')} />
        )}
        {liveContest ? (
          <LiveContestCard contest={liveContest} />
        ) : (
          <ContestsList contests={contests} canHost={canHost} />
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <RoomsTable rooms={rooms} userId={user?.id} canHost={canHost} />
        <div className="grid gap-4">
          <JoinWithCode />
          {liveContest && <ContestsList contests={contests} canHost={canHost} />}
        </div>
      </div>

      <CreateDialog
        open={creating === 'room'}
        onOpenChange={(open) => setCreating(open ? 'room' : null)}
        title="Create an interview room"
        description="You'll get a 5-character code to share with the candidate."
        label="Room title"
        placeholder="Frontend interview with Ada"
        submitLabel="Create room"
        pending={roomMutation.isPending}
        onSubmit={(title) => roomMutation.mutate(title)}
      />
      <CreateDialog
        open={creating === 'contest'}
        onOpenChange={(open) => setCreating(open ? 'contest' : null)}
        title="Create a contest"
        description="It starts as a draft. Activate it when you're ready to score."
        label="Contest title"
        placeholder="Algorithms sprint, round 1"
        submitLabel="Create contest"
        pending={contestMutation.isPending}
        onSubmit={(title) => contestMutation.mutate(title)}
      />
    </>
  )
}
