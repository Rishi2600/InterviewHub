import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ANSWER_CHARS } from './labels'

/**
 * Where the candidate types an answer. Enter sends, Shift+Enter adds a
 * line. An answer the AI couldn't reply to comes back here (`restore`).
 */
export function PracticeComposer({
  onSend,
  disabled,
  disabledReason,
  restore,
  extra,
  className,
}: {
  onSend: (text: string) => void
  disabled: boolean
  disabledReason?: string
  restore: string | null
  /** Controls beside the counter, such as "Use voice". */
  extra?: ReactNode
  className?: string
}) {
  const [text, setText] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)

  // An answer handed back: put it in the box again.
  const [restored, setRestored] = useState(restore)
  if (restore !== restored) {
    setRestored(restore)
    if (restore) setText(restore)
  }

  const send = () => {
    const value = text.trim()
    if (!value || disabled) return
    onSend(value)
    setText('')
  }

  return (
    <div className={cn('rounded-xl border bg-card focus-within:border-primary', className)}>
      <textarea
        ref={box}
        rows={2}
        value={text}
        maxLength={ANSWER_CHARS}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            send()
          }
        }}
        placeholder={disabled && disabledReason ? disabledReason : 'Your answer. Enter sends, Shift+Enter adds a line.'}
        aria-label="Your answer"
        className="block max-h-48 w-full resize-none bg-transparent px-3.5 pt-3 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center gap-2 px-2 pb-2">
        {extra}
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {text.length.toLocaleString()} / {ANSWER_CHARS.toLocaleString()}
        </span>
        <Button size="icon-sm" aria-label="Send" onClick={send} disabled={disabled || !text.trim()}>
          <SendHorizontal aria-hidden />
        </Button>
      </div>
    </div>
  )
}
