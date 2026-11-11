import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { connectPractice } from '@/lib/sockets'
import type { ConnectionStatus } from '@/lib/sockets'
import type { CodingQuestion, PracticeInterview, PracticeStatus, PracticeTurn } from '@/types'

interface Ended {
  status: PracticeStatus
  reason: string
}

/**
 * The live side of a practice interview over /practice. Joining sends the
 * interview's turns so far; the first join also starts the AI's greeting.
 * The AI's reply arrives in pieces (practice:delta) and then as a finished
 * turn. An answer the AI couldn't reply to comes back (practice:retracted)
 * so it can be sent again.
 */
export function usePracticeSocket(interview: PracticeInterview) {
  const id = interview.id
  const socketRef = useRef<Socket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [turns, setTurns] = useState<PracticeTurn[]>(interview.turns)
  const [question, setQuestion] = useState<CodingQuestion | null>(interview.codingQuestion)
  // The AI's reply as it is written, and whether one is on its way.
  const [draft, setDraft] = useState('')
  const [waiting, setWaiting] = useState(interview.turns.length === 0 && interview.status === 'active')
  const [failure, setFailure] = useState<string | null>(null)
  const [retracted, setRetracted] = useState<string | null>(null)
  const [ended, setEnded] = useState<Ended | null>(null)
  const [feedback, setFeedback] = useState<PracticeStatus | null>(null)

  useEffect(() => {
    const socket = connectPractice()
    socketRef.current = socket

    const join = () => {
      socket.emit('practice:join', { interviewId: id }, (ack: { ok: boolean; interview: PracticeInterview }) => {
        if (!ack?.ok) return
        setTurns(ack.interview.turns)
        setQuestion(ack.interview.codingQuestion)
        if (ack.interview.status !== 'active') setEnded({ status: ack.interview.status, reason: ack.interview.endReason ?? '' })
        else if (ack.interview.turns.length === 0) setWaiting(true)
      })
    }
    socket.on('connect', () => {
      setStatus('connected')
      join()
    })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', () => setStatus('error'))
    socket.on('error', (e: { message?: string }) => {
      setWaiting(false)
      if (e?.message) toast.error(e.message)
    })

    socket.on('practice:delta', ({ text }: { text: string }) => {
      setWaiting(true)
      setDraft((d) => d + text)
    })
    socket.on('practice:turn', (turn: PracticeTurn) => {
      setTurns((t) => [...t, turn])
      if (turn.kind === 'ai') {
        setDraft('')
        setWaiting(false)
      } else if (turn.kind === 'candidate') {
        setWaiting(true)
        setFailure(null)
      }
    })
    socket.on('practice:question', (q: CodingQuestion) => setQuestion(q))
    socket.on('practice:retracted', ({ at, text, message }: { at: string; text: string; message: string }) => {
      setTurns((t) => t.filter((x) => !(x.kind === 'candidate' && x.at === at)))
      setDraft('')
      setWaiting(false)
      setRetracted(text)
      toast.error(message)
    })
    socket.on('practice:failed', ({ message }: { message: string }) => {
      setDraft('')
      setWaiting(false)
      setFailure(message)
    })
    socket.on('practice:ended', (e: Ended) => {
      setWaiting(false)
      setDraft('')
      setEnded(e)
    })
    socket.on('practice:feedback', ({ status: s }: { status: PracticeStatus }) => setFeedback(s))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [id])

  const answer = useCallback(
    (text: string, code?: string) => {
      setRetracted(null)
      socketRef.current?.emit('practice:answer', { interviewId: id, text, ...(code !== undefined && { code }) })
    },
    [id],
  )

  const recordRun = useCallback(
    (run: { input: string; output: string; status: 'ok' | 'error' | 'timeout'; ms: number }) => {
      socketRef.current?.emit('practice:run', { interviewId: id, ...run })
    },
    [id],
  )

  /** After a failed greeting: joining again asks for it once more. */
  const retryStart = useCallback(() => {
    setFailure(null)
    setWaiting(true)
    socketRef.current?.emit('practice:join', { interviewId: id })
  }, [id])

  return { status, turns, question, draft, waiting, failure, retracted, ended, feedback, answer, recordRun, retryStart }
}
