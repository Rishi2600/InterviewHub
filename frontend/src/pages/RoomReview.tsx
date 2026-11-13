import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, CircleCheck, ClipboardPen, Lock, MessageSquareOff, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/States'
import { UserAvatar } from '@/components/common/UserAvatar'
import { ReviewForm } from '@/components/review/ReviewForm'
import { draftProblem, emptyDraft } from '@/components/review/draft'
import type { ReviewDraft } from '@/components/review/draft'
import { ReviewView } from '@/components/review/ReviewView'
import { REVIEW_AREAS } from '@/components/practice/labels'
import { errorMessage } from '@/lib/api'
import { getRoom, getRoomReviews, saveRoomReview } from '@/lib/endpoints'
import type { Room, RoomReview as Review, RoomReviews } from '@/types'

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * After a live interview: interviewers review each candidate; a candidate
 * reads the reviews about them. Only those two ever see a review.
 */
export function RoomReview() {
  const { id = '' } = useParams<{ id: string }>()
  const room = useQuery({ queryKey: ['room', id], queryFn: () => getRoom(id), enabled: Boolean(id) })
  const reviews = useQuery({ queryKey: ['room-reviews', id], queryFn: () => getRoomReviews(id), enabled: Boolean(id) })

  const loading = room.isLoading || reviews.isLoading
  const failed = room.isError || reviews.isError
  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <Link to={`/rooms/${id}`} className="hidden truncate text-muted-foreground hover:text-foreground sm:inline">
              {room.data?.title ?? 'Room'}
            </Link>
            <ChevronRight className="hidden size-3.5 text-muted-foreground sm:inline" aria-hidden />
            <span className="truncate font-medium">Review</span>
          </span>
        }
      />
      {loading ? (
        <Skeleton className="mx-auto h-96 w-full max-w-6xl rounded-xl" />
      ) : failed || !room.data || !reviews.data ? (
        <ErrorState
          title="Couldn't load the reviews"
          message={errorMessage(room.error ?? reviews.error, 'Try again in a moment.')}
          onRetry={() => {
            void room.refetch()
            void reviews.refetch()
          }}
        />
      ) : reviews.data.role === 'reviewer' ? (
        <Reviewer room={room.data} data={reviews.data} />
      ) : (
        <Candidate room={room.data} data={reviews.data} />
      )}
    </>
  )
}

function RoomSummary({ room }: { room: Room }) {
  const candidates = room.participants.filter((p) => p.role === 'candidate')
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-xl font-semibold">{room.title}</h1>
        <span className="rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {room.state === 'ended' ? 'Ended' : 'Not ended yet'}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {room.endedAt ? `Ended ${when(room.endedAt)}` : `Started ${when(room.createdAt)}`} · {candidates.length}{' '}
        {candidates.length === 1 ? 'candidate' : 'candidates'}
      </p>
    </section>
  )
}

function Candidate({ room, data }: { room: Room; data: RoomReviews }) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <RoomSummary room={room} />
      {data.reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquareOff />}
          title={data.ended ? 'No review yet' : 'Reviews come after the interview'}
          description={
            data.ended && data.closesAt
              ? `Your interviewers can review you until ${day(data.closesAt)}. Only you and they will see it.`
              : 'Once the room ends, your interviewers can review you. Only you and they will see it.'
          }
        />
      ) : (
        data.reviews.map((r) => (
          <section key={r.id} className="rounded-xl border bg-card p-6">
            <ReviewView review={r} />
          </section>
        ))
      )}
      <p className="flex gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
        Reviews are private to you and the interviewer who wrote them, and don't change your candidate score.
      </p>
    </div>
  )
}

const toDraft = (r: Review | undefined): ReviewDraft =>
  r
    ? { kind: r.kind, topics: r.topics, scores: Object.fromEntries(r.areas.map((a) => [a.name, a.score])), note: r.note }
    : emptyDraft()

function Reviewer({ room, data }: { room: Room; data: RoomReviews }) {
  const [index, setIndex] = useState(0)
  const candidate = data.candidates[index]

  if (!data.ended) {
    return (
      <EmptyState
        icon={<Lock />}
        title="Reviews open when the room ends"
        description="End the room from its page, then come back here to review each candidate."
        action={
          <Button asChild variant="outline">
            <Link to={`/rooms/${room._id}`}>Back to the room</Link>
          </Button>
        }
      />
    )
  }
  if (!candidate) {
    return <EmptyState icon={<MessageSquareOff />} title="No candidates to review" description="No candidate joined this room." />
  }

  const done = new Set(data.reviews.map((r) => r.candidateId))
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">
            {room.title}
            {room.endedAt && ` · ended ${when(room.endedAt)}`}
          </div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold">
            <UserAvatar name={candidate.username} />
            Review {candidate.username}
            {done.has(candidate.userId) && <CircleCheck className="size-5 text-brand" aria-label="Reviewed" />}
          </h1>
        </div>
        {data.candidates.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ChevronLeft aria-hidden />
              Previous
            </Button>
            <span className="tabular-nums">
              {index + 1} of {data.candidates.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={index === data.candidates.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              {index < data.candidates.length - 1 ? `Next: ${data.candidates[index + 1].username}` : 'Next'}
              <ChevronRight aria-hidden />
            </Button>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3 text-sm">
        <ClipboardPen className="size-4 text-brand" aria-hidden />
        <span className="flex-1">
          {data.open && data.closesAt
            ? `The room has ended. Reviews help your candidates know what to practise. Open until ${day(data.closesAt)}.`
            : `Reviews for this room closed${data.closesAt ? ` on ${day(data.closesAt)}` : ''}. You can still read yours.`}
        </span>
      </div>

      {/* Keyed by candidate, so switching loads their saved review. */}
      <ReviewPanel
        key={candidate.userId}
        room={room}
        data={data}
        candidate={candidate}
        saved={data.reviews.find((r) => r.candidateId === candidate.userId)}
      />
    </div>
  )
}

const areasOf = (d: ReviewDraft) =>
  REVIEW_AREAS[d.kind].filter((a) => a in d.scores).map((name) => ({ name, score: d.scores[name] }))

/** One candidate's review: the form, and what they will see. */
function ReviewPanel({
  room,
  data,
  candidate,
  saved,
}: {
  room: Room
  data: RoomReviews
  candidate: { userId: string; username: string }
  saved: Review | undefined
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<ReviewDraft>(() => toDraft(saved))
  const save = useMutation({
    mutationFn: () =>
      saveRoomReview(room._id, candidate.userId, {
        kind: draft.kind,
        topics: draft.topics,
        areas: areasOf(draft),
        note: draft.note.trim(),
      }),
    onSuccess: (review) => {
      queryClient.setQueryData<RoomReviews>(['room-reviews', room._id], (d) =>
        d ? { ...d, reviews: [...d.reviews.filter((r) => r.id !== review.id), review] } : d,
      )
      toast.success(`Review of ${candidate.username} saved`)
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't save the review")),
  })
  const problem = draftProblem(draft)
  const preview = {
    reviewerName: 'you',
    roomTitle: room.title,
    kind: draft.kind,
    topics: draft.topics,
    areas: areasOf(draft),
    note: draft.note.trim(),
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-xl border bg-card">
        <div className="p-6">
          <ReviewForm draft={draft} onChange={setDraft} disabled={!data.open || save.isPending} />
        </div>
        <div className="grid gap-3 border-t px-6 py-4">
          {saved && (
            <div className="flex items-center gap-2 text-sm text-brand">
              <CircleCheck className="size-4" aria-hidden />
              Saved {when(saved.updatedAt)}
              {data.open && data.closesAt && ` · you can change it until ${day(data.closesAt)}`}
            </div>
          )}
          {data.open && (
            <div className="flex flex-wrap items-center gap-3">
              <Button className="h-10 px-5" disabled={!!problem || save.isPending} onClick={() => save.mutate()}>
                <Send aria-hidden />
                {saved ? 'Update review' : 'Save review'}
              </Button>
              <span className="text-xs text-muted-foreground">{problem ?? (data.closesAt && `Open until ${day(data.closesAt)}`)}</span>
            </div>
          )}
          <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-brand" aria-hidden />
            Only {candidate.username} and you see this. It doesn't change their candidate score; it helps their prep suggestions.
          </p>
        </div>
      </section>
      <section className="rounded-xl border bg-card lg:sticky lg:top-24">
        <div className="flex items-center gap-2 border-b px-5 py-3.5">
          <h2 className="text-base font-semibold">What {candidate.username} sees</h2>
          <span className="ml-auto text-xs text-muted-foreground">Preview</span>
        </div>
        <div className="p-5">
          <ReviewView review={preview} showHeading={false} />
        </div>
      </section>
    </div>
  )
}
