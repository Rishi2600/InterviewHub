import { useCallback, useEffect, useRef, useState } from 'react'

// The parts of the Web Speech API used here. TypeScript's DOM types don't
// include recognition, which Chrome and Safari still prefix with "webkit".
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionClass = new () => Recognition

function recognitionClass(): RecognitionClass | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Whether this browser can listen (Chrome, Edge, Safari) and speak. */
export const voiceSupport = () => ({
  listen: typeof window !== 'undefined' && recognitionClass() !== null,
  speak: typeof window !== 'undefined' && 'speechSynthesis' in window,
})

// Silence after speech that sends the answer.
export const PAUSE_MS = 2_000

/** Text read aloud without the markdown the AI sometimes uses. */
const speakable = (text: string) => text.replace(/[`*_#]/g, '')

/**
 * Voice for a practice interview, from the browser's own speech: listening
 * turns speech into text (in Chrome the audio goes to Google for that) and
 * sends it after a pause; speaking reads the AI's replies aloud. Listening
 * stops while the AI writes or speaks, so it never hears itself.
 */
export function useVoice({ on, paused, onAnswer }: { on: boolean; paused: boolean; onAnswer: (text: string) => void }) {
  const [heard, setHeard] = useState('')
  const [interim, setInterim] = useState('')
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const finalText = useRef('')
  const interimText = useRef('')
  const want = on && !paused && !speaking && !error
  const wantRef = useRef(want)
  const answerRef = useRef(onAnswer)

  useEffect(() => {
    wantRef.current = want
    answerRef.current = onAnswer
  })

  /** Sends what was heard so far, if anything. */
  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const text = `${finalText.current} ${interimText.current}`.trim()
    finalText.current = ''
    interimText.current = ''
    setHeard('')
    setInterim('')
    if (text) answerRef.current(text)
  }, [])

  // Start or stop the recognizer as the conditions change.
  useEffect(() => {
    const Rec = recognitionClass()
    if (!want || !Rec) return
    const r = new Rec()
    r.continuous = true
    r.interimResults = true
    r.lang = 'en-US'
    r.onresult = (e) => {
      let pending = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        if (result.isFinal) finalText.current = `${finalText.current} ${result[0].transcript}`.trim()
        else pending += result[0].transcript
      }
      interimText.current = pending
      setHeard(finalText.current)
      setInterim(pending)
      // A pause after speaking sends the answer.
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, PAUSE_MS)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access is blocked. Allow it in the browser, or type your answers.')
      } else if (e.error === 'audio-capture') {
        setError('No microphone was found. Connect one, or type your answers.')
      } else if (e.error === 'network') {
        setError("Speech recognition couldn't reach its service. Type your answers for now.")
      }
    }
    r.onstart = () => setListening(true)
    // Browsers stop listening after a while; start again while wanted.
    r.onend = () => {
      setListening(false)
      if (wantRef.current && rec.current === r) {
        try {
          r.start()
        } catch {
          // Already starting again.
        }
      }
    }
    rec.current = r
    try {
      r.start()
    } catch {
      // Starting twice throws; the running one carries on.
    }
    return () => {
      rec.current = null
      r.onend = null
      r.onstart = null
      r.abort()
      window.clearTimeout(timer.current)
    }
  }, [want, flush])

  /** Reads a reply aloud; listening waits until it's done. */
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(speakable(text))
    u.lang = 'en-US'
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('en') && v.localService)
    if (voice) u.voice = voice
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  // Nothing keeps talking after the page closes or voice is turned off.
  useEffect(() => {
    if (!on) window.speechSynthesis?.cancel()
  }, [on])
  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  return {
    text: `${heard} ${interim}`.trim(),
    // Listening only counts while it's wanted; the recognizer may lag.
    listening: listening && want,
    pending: interim,
    speaking,
    error,
    sendNow: flush,
    speak,
    stopSpeaking,
    clearError: () => setError(null),
  }
}
