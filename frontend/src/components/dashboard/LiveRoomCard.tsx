import { Link } from 'react-router-dom'
import { Copy, DoorOpen, Pin, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { JoinCodeTiles } from '@/components/common/JoinCodeTiles'
import { LiveDot } from '@/components/common/LiveDot'
import { UserAvatar } from '@/components/common/UserAvatar'
import { useCopy } from '@/hooks/useCopy'
import { formatTime } from '@/lib/utils'
import type { Room } from '@/types'

const ROLE = { candidate: 'Candidate', interviewer: 'Interviewer', admin: 'Admin' } as const

/** The interview running now: its code, who is in it and the pinned question. */
export function LiveRoomCard({ room, userId }: { room: Room; userId?: string }) {
  const copy = useCopy()
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2.5 font-heading">
          <LiveDot />
          <span className="truncate">{room.title}</span>
        </CardTitle>
        <CardDescription>In progress. Opened at {formatTime(room.createdAt)}.</CardDescription>
        <CardAction>
          <Badge>Active</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Join code</p>
            <JoinCodeTiles code={room.code} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => copy(room.code, 'Join code copied')}>
              <Copy aria-hidden />
              Copy code
            </Button>
            <Button asChild>
              <Link to={`/rooms/${room._id}`}>Open room</Link>
            </Button>
          </div>
        </div>

        {room.participants.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">In the room</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {room.participants.map((p) => (
                <li key={p.userId} className="flex items-center gap-2.5 rounded-md border px-3 py-2.5">
                  <UserAvatar name={p.username} />
                  <div className="grid min-w-0 leading-tight">
                    <span className="truncate text-sm font-medium">{p.username}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {p.userId === userId ? 'You' : ROLE[p.role]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {room.pinnedQuestion && (
          <p className="flex min-w-0 items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-sm">
            <Pin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Pinned:</span>
            <span className="min-w-0 truncate">{room.pinnedQuestion}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Shown in the live room's place when nothing is running. */
export function NoLiveRoomCard({ canHost, onCreate }: { canHost: boolean; onCreate: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">No interview running</CardTitle>
        <CardDescription>
          {canHost
            ? 'Open a room to get a join code you can share with a candidate.'
            : 'Ask your interviewer for a 5-character join code.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canHost ? (
          <Button onClick={onCreate}>
            <Plus aria-hidden />
            New room
          </Button>
        ) : (
          <Button asChild>
            <Link to="/rooms/join">
              <DoorOpen aria-hidden />
              Join a room
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
