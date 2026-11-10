import { useEffect, useRef } from 'react'
import { MicOff, VideoOff, WifiOff } from 'lucide-react'
import { UserAvatar } from '@/components/common/UserAvatar'
import { cn } from '@/lib/utils'

/** Plays a stream in a <video>; muted for your own, so you don't hear yourself. */
export function StreamVideo({
  stream,
  muted,
  mirrored,
  className,
}: {
  stream: MediaStream | null
  muted?: boolean
  mirrored?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream
  }, [stream])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn('size-full object-cover', mirrored && '-scale-x-100', className)}
    />
  )
}

/** One person on the call: their camera, or their initials with it off. */
export function VideoTile({
  name,
  stream,
  mic,
  cam,
  self,
  connecting,
  className,
}: {
  name: string
  stream: MediaStream | null
  mic: boolean
  cam: boolean
  self?: boolean
  connecting?: boolean
  className?: string
}) {
  const showVideo = cam && !!stream?.getVideoTracks().length
  return (
    <div className={cn('relative aspect-video overflow-hidden rounded-lg bg-[#0d1312]', className)}>
      {/* Always mounted, so the person is heard even with the camera off. */}
      <StreamVideo stream={stream} muted={self} mirrored={self} className={cn(!showVideo && 'invisible')} />
      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <UserAvatar name={name} size="lg" className="size-12 text-sm" />
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 inline-flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
        {!mic && <MicOff className="size-3 shrink-0 text-red-400" aria-label="Muted" />}
        <span className="truncate">
          {name}
          {self && ' (you)'}
        </span>
      </span>
      {!cam && (
        <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded bg-black/65 text-white">
          <VideoOff className="size-3" aria-label="Camera off" />
        </span>
      )}
      {connecting && (
        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] text-white">
          <WifiOff className="size-3" aria-hidden />
          Connecting…
        </span>
      )}
    </div>
  )
}
