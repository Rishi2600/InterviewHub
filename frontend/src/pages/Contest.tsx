import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronRight, Ellipsis, Flag, Link2, LogIn, Play } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/common/StatusBadge'
import { EmptyState, ErrorState } from '@/components/common/States'
import { UserAvatar } from '@/components/common/UserAvatar'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConnectionStatus } from '@/components/chat/ConnectionStatus'
import { Leaderboard } from '@/components/contest/Leaderboard'
import { ScorePanel } from '@/components/contest/ScorePanel'
import { useAuth } from '@/hooks/useAuth'
import { useCopy } from '@/hooks/useCopy'
import { useLeaderboardSocket } from '@/hooks/useLeaderboardSocket'
import {
  activateContest,
  endContest,
  getContest,
  getContestResults,
  joinContest,
  scoreContestant,
} from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

const SUBTITLE = {
  draft: 'In draft. Activate it to start scoring.',
  active: 'Scores update live for everyone watching.',
  ended: 'Final standings.',
} as const

export function Contest() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [endOpen, setEndOpen] = useState(false)
  const copy = useCopy()

  const contestQuery = useQuery({
    queryKey: ['contest', id],
    queryFn: () => getContest(id!),
    enabled: Boolean(id),
  })

  // The entry roster doubles as our userId -> username map, because the live
  // leaderboard payload carries ids only.
  const entriesQuery = useQuery({
    queryKey: ['contest-entries', id],
    queryFn: () => getContestResults(id!),
    enabled: Boolean(id),
  })

  const contest = contestQuery.data
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])

  const namesByUserId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const entry of entries) map[entry.userId] = entry.username
    return map
  }, [entries])

  const isOwner = Boolean(contest && user && contest.ownerId === user.id)
  const canHost = isOwner || user?.role === 'admin'
  const hasJoined = entries.some((e) => e.userId === user?.id)
  // The server only lets hosts and entrants subscribe to the live board.
  const canWatch = canHost || hasJoined
  const board = useLeaderboardSocket(canWatch ? id : undefined)

  function refreshEntries() {
    void queryClient.invalidateQueries({ queryKey: ['contest-entries', id] })
  }

  const activateMutation = useMutation({
    mutationFn: () => activateContest(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['contest', id], updated)
      toast.success('Contest is live')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not activate the contest')),
  })

  const endMutation = useMutation({
    mutationFn: () => endContest(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['contest', id], updated)
      // Final scores are written to Mongo on end — refetch to show them.
      refreshEntries()
      toast.success('Contest ended. Final scores saved.')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not end the contest')),
  })

  const joinMutation = useMutation({
    mutationFn: () => joinContest(id!),
    onSuccess: () => {
      refreshEntries()
      toast.success('You joined the contest')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not join the contest')),
  })

  const scoreMutation = useMutation({
    mutationFn: ({ userId, delta }: { userId: string; delta: number }) =>
      scoreContestant(id!, userId, delta),
    onMutate: ({ userId }) => setPendingUserId(userId),
    onSettled: () => setPendingUserId(null),
    // No manual board update needed — the server broadcasts the new standings.
    onError: (err) => toast.error(errorMessage(err, 'Could not apply the score')),
  })

  if (contestQuery.isLoading) return <ContestSkeleton />
  if (contestQuery.isError || !contest) {
    return (
      <ErrorState
        title="Couldn't load this contest"
        message={errorMessage(contestQuery.error, 'It may not exist, or you may not have access.')}
        onRetry={() => void contestQuery.refetch()}
      />
    )
  }

  const isEnded = contest.state === 'ended'
  const isActive = contest.state === 'active'
  const finalRows = [...entries]
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((e, i) => ({ userId: e.userId, rank: e.finalRank || i + 1, score: e.finalScore }))

  return (
    <>
      <PageHeader
        title={
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Link to="/" className="hidden hover:text-foreground sm:inline">
              Dashboard
            </Link>
            <ChevronRight className="hidden size-3.5 sm:inline" aria-hidden />
            <span className="truncate text-foreground">{contest.title}</span>
          </nav>
        }
      >
        {!hasJoined && !canHost && !isEnded && (
          <Button size="sm" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
            <LogIn aria-hidden />
            Join contest
          </Button>
        )}
        {canHost && contest.state === 'draft' && (
          <Button size="sm" onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending}>
            <Play aria-hidden />
            Activate
          </Button>
        )}
        {canHost && isActive && (
          <Button variant="outline" size="sm" className="text-danger" onClick={() => setEndOpen(true)}>
            <Flag aria-hidden />
            <span className="hidden sm:inline">End contest</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="More actions">
              <Ellipsis aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => copy(window.location.href, 'Contest link copied')}>
              <Link2 aria-hidden />
              Copy contest link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">{contest.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <StatusBadge state={contest.state} />
          {canWatch && !isEnded && <ConnectionStatus status={board.status} />}
          <span>{SUBTITLE[contest.state]}</span>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="font-heading">{isEnded ? 'Final standings' : 'Live leaderboard'}</CardTitle>
            <CardDescription>
              {isEnded ? 'Scores as they stood when the contest ended.' : 'Top 10, updated the moment a score changes.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isEnded ? (
              <Leaderboard
                rows={finalRows}
                namesByUserId={namesByUserId}
                currentUserId={user?.id ?? ''}
                isLoading={entriesQuery.isLoading}
                emptyTitle="No final scores"
                emptyDescription="This contest ended without any scored participants."
              />
            ) : !canWatch ? (
              <EmptyState
                title="Join to see the live leaderboard"
                description="Standings are visible to the host and to participants."
                action={
                  !isEnded && (
                    <Button size="sm" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
                      <LogIn aria-hidden />
                      Join contest
                    </Button>
                  )
                }
              />
            ) : (
              <Leaderboard
                rows={board.rows}
                namesByUserId={namesByUserId}
                currentUserId={user?.id ?? ''}
                isLoading={!board.hasLoaded && board.status === 'connecting'}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {canHost && !isEnded && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Award points</CardTitle>
                <CardDescription>Only you and admins see this.</CardDescription>
              </CardHeader>
              <CardContent>
                {entriesQuery.isLoading ? (
                  <Skeleton className="h-24" />
                ) : (
                  <ScorePanel
                    entries={entries}
                    pendingUserId={pendingUserId}
                    disabled={!isActive}
                    disabledReason={!isActive ? 'Activate the contest before awarding points.' : undefined}
                    onScore={(userId, delta) => scoreMutation.mutate({ userId, delta })}
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Participants</CardTitle>
              <CardDescription>
                {entries.length === 1 ? '1 person has joined' : `${entries.length} people have joined`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entriesQuery.isLoading ? (
                <Skeleton className="h-24" />
              ) : entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one yet. Anyone with the link can join while the contest is open.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {entries.map((entry) => (
                    <li key={entry.userId} className="flex items-center gap-2.5 text-sm">
                      <UserAvatar name={entry.username} size="sm" />
                      <span className="truncate">
                        {entry.username}
                        {entry.userId === user?.id && <span className="text-muted-foreground"> (you)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={endOpen} onOpenChange={setEndOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this contest?</AlertDialogTitle>
            <AlertDialogDescription>
              Scoring stops and the current standings become the final results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => endMutation.mutate()}>
              End contest
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ContestSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </>
  )
}
