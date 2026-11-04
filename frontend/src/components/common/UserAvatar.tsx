import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, initials } from '@/lib/utils'

const SIZES = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-16 text-lg',
} as const

/** A person's photo, or their initials when there is none. */
export function UserAvatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="font-medium">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
