import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, DoorOpen, Ellipsis, Square } from 'lucide-react'
import { toast } from 'sonner'
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
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/common/StatusBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { useCopy } from '@/hooks/useCopy'
import { setRoomState } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import type { Room } from '@/types'

/** Every room the user owns or joined, with per-row actions. */
export function RoomsTable({ rooms, userId, canHost }: { rooms: Room[]; userId?: string; canHost: boolean }) {
  const navigate = useNavigate()
  const copy = useCopy()
  const queryClient = useQueryClient()
  const [ending, setEnding] = useState<Room | null>(null)

  const endRoom = useMutation({
    mutationFn: (id: string) => setRoomState(id, 'ended'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['rooms'] })
      toast.success('Room ended')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not end the room')),
  })

  return (
    <Card className="min-w-0 gap-0 pb-0">
      <CardHeader className="pb-6">
        <CardTitle className="font-heading">Your rooms</CardTitle>
        <CardDescription>Rooms you own or have joined.</CardDescription>
      </CardHeader>
      {rooms.length === 0 ? (
        <p className="border-t px-6 py-6 text-sm text-muted-foreground">
          {canHost
            ? 'No rooms yet. Create one to get a join code you can share.'
            : 'No rooms yet. Enter a join code to join your first one.'}
        </p>
      ) : (
        <Table className="min-w-[40rem]">
          <TableHeader className="border-t bg-muted/40">
            <TableRow>
              <TableHead className="pl-6">Room</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>People</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.map((room) => {
              const owned = room.ownerId === userId
              const lead = room.participants.find((p) => p.userId !== room.ownerId)
              return (
                <TableRow key={room._id}>
                  <TableCell className="pl-6">
                    <Link to={`/rooms/${room._id}`} className="flex min-w-0 items-center gap-2.5">
                      {lead ? (
                        <UserAvatar name={lead.username} />
                      ) : (
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <DoorOpen className="size-4" aria-hidden />
                        </span>
                      )}
                      <span className="grid min-w-0 leading-tight">
                        <span className="truncate font-medium">{room.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {owned ? 'You own this room' : 'Joined'}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs tracking-[0.12em]">{room.code}</TableCell>
                  <TableCell>
                    <StatusBadge state={room.state} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {room.participants.slice(0, 4).map((p) => (
                        <UserAvatar key={p.userId} name={p.username} size="sm" />
                      ))}
                      {room.participants.length === 0 && <span className="text-muted-foreground">None yet</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(room.updatedAt)}</TableCell>
                  <TableCell className="pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${room.title}`}>
                          <Ellipsis aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => navigate(`/rooms/${room._id}`)}>
                          <DoorOpen aria-hidden />
                          Open room
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => copy(room.code, 'Join code copied')}>
                          <Copy aria-hidden />
                          Copy join code
                        </DropdownMenuItem>
                        {owned && room.state !== 'ended' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setEnding(room)}>
                              <Square aria-hidden />
                              End room
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={ending !== null} onOpenChange={(open) => !open && setEnding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this room?</AlertDialogTitle>
            <AlertDialogDescription>
              {ending?.title} will close for everyone. The chat stays readable, but no one can send
              messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => ending && endRoom.mutate(ending._id)}
            >
              End room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
