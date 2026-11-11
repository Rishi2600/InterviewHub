import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { PAUSE_MS, useVoice } from './useVoice'

/** Stands in for the browser's speech recognizer. */
class FakeRecognition {
  static last: FakeRecognition | null = null
  static started = 0
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  onstart: (() => void) | null = null
  running = false
  constructor() {
    FakeRecognition.last = this
  }
  start() {
    this.running = true
    FakeRecognition.started++
    this.onstart?.()
  }
  stop() {
    this.running = false
  }
  abort() {
    this.running = false
  }
  /** The recognizer hears something: final words, then words still forming. */
  hear(final: string, interim = '') {
    const results = [
      ...(final ? [{ isFinal: true, 0: { transcript: final } }] : []),
      ...(interim ? [{ isFinal: false, 0: { transcript: interim } }] : []),
    ]
    act(() => this.onresult?.({ resultIndex: 0, results }))
  }
}

describe('useVoice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeRecognition.last = null
    FakeRecognition.started = 0
    ;(window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition
  })
  afterEach(() => {
    vi.useRealTimers()
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  it('sends what was said after a pause', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useVoice({ on: true, paused: false, onAnswer }))
    expect(result.current.listening).toBe(true)
    FakeRecognition.last!.hear('A tuple is', 'immutable')
    expect(result.current.text).toBe('A tuple is immutable')
    act(() => vi.advanceTimersByTime(PAUSE_MS - 100))
    expect(onAnswer).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(onAnswer).toHaveBeenCalledWith('A tuple is immutable')
    expect(result.current.text).toBe('')
  })

  it('keeps waiting while the candidate keeps talking', () => {
    const onAnswer = vi.fn()
    renderHook(() => useVoice({ on: true, paused: false, onAnswer }))
    FakeRecognition.last!.hear('First')
    act(() => vi.advanceTimersByTime(PAUSE_MS - 500))
    FakeRecognition.last!.hear('', 'and then')
    act(() => vi.advanceTimersByTime(PAUSE_MS - 500))
    expect(onAnswer).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(600))
    expect(onAnswer).toHaveBeenCalledWith('First and then')
  })

  it('sends at once with "Send now"', () => {
    const onAnswer = vi.fn()
    const { result } = renderHook(() => useVoice({ on: true, paused: false, onAnswer }))
    FakeRecognition.last!.hear('', 'half a thought')
    act(() => result.current.sendNow())
    expect(onAnswer).toHaveBeenCalledWith('half a thought')
  })

  it("doesn't listen while paused or off", () => {
    const { result, rerender } = renderHook((props: { on: boolean; paused: boolean }) => useVoice({ ...props, onAnswer: vi.fn() }), {
      initialProps: { on: false, paused: false },
    })
    expect(FakeRecognition.started).toBe(0)
    rerender({ on: true, paused: true })
    expect(FakeRecognition.started).toBe(0)
    expect(result.current.listening).toBe(false)
    rerender({ on: true, paused: false })
    expect(FakeRecognition.started).toBe(1)
    rerender({ on: true, paused: true })
    expect(FakeRecognition.last!.running).toBe(false)
  })

  it('starts again when the browser stops listening on its own', () => {
    renderHook(() => useVoice({ on: true, paused: false, onAnswer: vi.fn() }))
    act(() => FakeRecognition.last!.onend?.())
    expect(FakeRecognition.started).toBe(2)
  })

  it('stops for good and explains when the microphone is blocked', () => {
    const { result } = renderHook(() => useVoice({ on: true, paused: false, onAnswer: vi.fn() }))
    act(() => FakeRecognition.last!.onerror?.({ error: 'not-allowed' }))
    expect(result.current.error).toContain('Microphone access is blocked')
    expect(result.current.listening).toBe(false)
  })
})
