import { useEffect, useState } from 'react'
import { Loader2, Mic, MicOff, PhoneOff, ScreenShare, Settings2, Video, VideoOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LocalMedia } from '@/hooks/useCall'
import { cn } from '@/lib/utils'

const ROUND = 'grid size-9 shrink-0 place-items-center rounded-full border'

function RoundButton({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(ROUND, on ? 'bg-card hover:bg-muted' : 'border-danger/40 bg-danger/10 text-danger')}
    >
      {children}
    </button>
  )
}

/** Camera and microphone pickers. Lists devices once the browser allows it. */
function DevicePicker({
  local,
  onSwitch,
}: {
  local: LocalMedia
  onSwitch: (kind: 'audio' | 'video', deviceId: string) => void
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    const load = () => void navigator.mediaDevices?.enumerateDevices().then(setDevices)
    load()
    navigator.mediaDevices?.addEventListener('devicechange', load)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', load)
  }, [local.camera])

  const current = (kind: 'audio' | 'video') =>
    (kind === 'audio' ? local.camera?.getAudioTracks() : local.camera?.getVideoTracks())?.[0]?.getSettings().deviceId ?? ''
  const group = (kind: 'audio' | 'video', label: string) => {
    const list = devices.filter((d) => d.kind === `${kind}input` && d.deviceId)
    return (
      <>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {list.length === 0 ? (
          <p className="px-2 pb-1.5 text-xs text-muted-foreground">None found</p>
        ) : (
          <DropdownMenuRadioGroup value={current(kind)} onValueChange={(id) => onSwitch(kind, id)}>
            {list.map((d, i) => (
              <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId}>
                <span className="truncate">{d.label || `${label} ${i + 1}`}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Camera and microphone" title="Camera and microphone" className={cn(ROUND, 'bg-card hover:bg-muted')}>
          <Settings2 className="size-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="w-64">
        {group('video', 'Camera')}
        <DropdownMenuSeparator />
        {group('audio', 'Microphone')}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Mute, camera, share, devices, leave: floats at the bottom of the room. */
export function CallBar({
  joined,
  joining,
  local,
  canShare,
  onJoin,
  onLeave,
  onToggleMic,
  onToggleCam,
  onShare,
  onStopShare,
  onSwitchDevice,
}: {
  joined: boolean
  joining: boolean
  local: LocalMedia
  canShare: boolean
  onJoin: () => void
  onLeave: () => void
  onToggleMic: () => void
  onToggleCam: () => void
  onShare: () => void
  onStopShare: () => void
  onSwitchDevice: (kind: 'audio' | 'video', deviceId: string) => void
}) {
  if (!joined) {
    return (
      <Button className="h-9 rounded-full px-4" onClick={onJoin} disabled={joining}>
        {joining ? <Loader2 className="animate-spin" aria-hidden /> : <Video aria-hidden />}
        {joining ? 'Joining…' : 'Join call'}
      </Button>
    )
  }
  const sharing = !!local.screen
  return (
    <div className="flex items-center justify-center gap-1.5">
      <RoundButton on={local.mic} label={local.mic ? 'Mute' : 'Unmute'} onClick={onToggleMic}>
        {local.mic ? <Mic className="size-4" aria-hidden /> : <MicOff className="size-4" aria-hidden />}
      </RoundButton>
      <RoundButton on={local.cam} label={local.cam ? 'Turn camera off' : 'Turn camera on'} onClick={onToggleCam}>
        {local.cam ? <Video className="size-4" aria-hidden /> : <VideoOff className="size-4" aria-hidden />}
      </RoundButton>
      {canShare && (
        <button
          type="button"
          onClick={sharing ? onStopShare : onShare}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium',
            sharing ? 'bg-primary text-primary-foreground' : 'border bg-card hover:bg-muted',
          )}
        >
          <ScreenShare className="size-4" aria-hidden />
          <span className="hidden sm:inline">{sharing ? 'Stop sharing' : 'Share screen'}</span>
        </button>
      )}
      <DevicePicker local={local} onSwitch={onSwitchDevice} />
      <button
        type="button"
        aria-label="Leave call"
        title="Leave call"
        onClick={onLeave}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#dc2626] px-3 text-sm font-medium text-white hover:bg-[#b91c1c]"
      >
        <PhoneOff className="size-4" aria-hidden />
        <span className="hidden sm:inline">Leave</span>
      </button>
    </div>
  )
}
