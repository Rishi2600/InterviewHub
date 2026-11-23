import { cn } from '@/lib/utils'

/** The mark: a gold square over a green one, like two days on the activity
 *  graph. Sized by its class (size-6 by default); the squares scale with it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-block size-6 shrink-0', className)} aria-hidden>
      <span className="absolute top-[28%] left-[28%] size-[72%] rounded-[12%] bg-stem" />
      <span className="absolute top-0 left-0 size-[72%] rounded-[12%] bg-fruit" />
    </span>
  )
}
