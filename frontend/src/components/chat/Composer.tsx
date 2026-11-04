import { useEffect, useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { Button } from '@/components/legacy/Button'

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
    <div className="border-t border-line p-3">
      {disabled && disabledReason && (
        <p className="mb-2 text-micro text-ink-faint">{disabledReason}</p>
      )}
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
        <textarea
          id="composer"
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabled ? 'Chat unavailable' : 'Write a message…'}
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
          className="max-h-[140px] min-h-9 flex-1 resize-none rounded-[var(--radius-control)] border border-line bg-ground px-3 py-2 text-caption text-ink transition-colors duration-[var(--duration-fast)] hover:border-line-strong focus:border-line-strong disabled:cursor-not-allowed disabled:text-ink-disabled"
        />
        {/* Sending is the primary action inside the chat panel. */}
        <Button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="shrink-0"
        >
          <SendHorizontal className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </div>
  )
}