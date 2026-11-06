import { useEffect, useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from '@/lib/limits'

const TYPING_IDLE_MS = 1200

/**
 * Message composer. Enter sends, Shift+Enter adds a newline. Typing signals
 * are debounced so we emit `chat:typing` once, then `chat:stop_typing` after
 * a pause — not on every keystroke.
 */
export function Composer({
  onSend,
  onStartTyping,
  onStopTyping,
  disabled,
  disabledReason,
}: {
  onSend: (content: string) => void
  onStartTyping: () => void
  onStopTyping: () => void
  disabled?: boolean
  disabledReason?: string
}) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isTypingRef = useRef(false)
  const idleTimer = useRef<number | undefined>(undefined)

  // Grow the textarea with its content, up to a ceiling.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])

  useEffect(() => {
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current)
    }
  }, [])

  function signalTyping() {
    if (!isTypingRef.current) {
      isTypingRef.current = true
      onStartTyping()
    }
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => {
      isTypingRef.current = false
      onStopTyping()
    }, TYPING_IDLE_MS)
  }

  function endTyping() {
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    if (isTypingRef.current) {
      isTypingRef.current = false
      onStopTyping()
    }
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    endTyping()
  }

  return (
    <div className="border-t p-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <Textarea
          id="composer"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabled ? 'Chat unavailable' : 'Message the room'}
          maxLength={LIMITS.text}
          onChange={(e) => {
            setValue(e.target.value)
            if (e.target.value.trim()) signalTyping()
            else endTyping()
          }}
          onBlur={endTyping}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          className="max-h-36 min-h-10 resize-none"
        />
        <Button type="submit" disabled={disabled || !value.trim()} aria-label="Send message" className="h-10">
          <SendHorizontal aria-hidden />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        {disabled && disabledReason ? disabledReason : 'Enter to send, Shift+Enter for a new line'}
      </p>
    </div>
  )
}
