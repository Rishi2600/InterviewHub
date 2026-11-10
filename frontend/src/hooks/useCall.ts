import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { getIceServers } from '@/lib/endpoints'

/** Someone else in the call, as the server introduced them. */
interface PeerInfo {
  socketId: string
  userId: string
  username: string
  role: string
  mic: boolean
  cam: boolean
  sharing: boolean
  screenId?: string
}

export interface CallPeer extends PeerInfo {
  camera: MediaStream | null
  screen: MediaStream | null
  connection: RTCPeerConnectionState
}

export interface LocalMedia {
  camera: MediaStream | null
  screen: MediaStream | null
  mic: boolean
  cam: boolean
}

type Signal = { from: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }

/** One peer-to-peer connection, with "perfect negotiation" bookkeeping. */
interface Link {
  pc: RTCPeerConnection
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  // Signals are handled one at a time, in order.
  chain: Promise<void>
  streams: Map<string, MediaStream>
  screenSenders: RTCRtpSender[]
}

const NO_MEDIA: LocalMedia = { camera: null, screen: null, mic: true, cam: true }

/** Camera and microphone, falling back to the microphone alone, then nothing:
 *  someone without a camera can still see and hear the others. */
async function getMedia(): Promise<MediaStream> {
  const video: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 } }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video })
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      toast.info('No camera available. You can still talk and watch.')
      return stream
    } catch {
      toast.info('No camera or microphone available. You can still watch and listen.')
      return new MediaStream()
    }
  }
}

/**
 * A peer-to-peer call among the people in a room (up to 4), with the room's
 * socket carrying the setup messages. Each pair of people has its own
 * RTCPeerConnection. Screen sharing adds a second video track; its stream id
 * travels in `call:state` so the others can tell it from the camera. See
 * docs/learning/webrtc/.
 */
export function useCall({
  socket,
  roomId,
  inRoom,
  ended,
}: {
  socket: Socket | null
  roomId: string
  inRoom: boolean
  ended: boolean
}) {
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [local, setLocalState] = useState<LocalMedia>(NO_MEDIA)
  const [peers, setPeers] = useState<Record<string, CallPeer>>({})

  const links = useRef(new Map<string, Link>())
  const localRef = useRef<LocalMedia>(NO_MEDIA)
  // The person wants to be in the call: survives socket reconnects.
  const wanted = useRef(false)
  const joinedRef = useRef(false)
  const iceServers = useRef<RTCIceServer[] | null>(null)

  const setLocal = useCallback((patch: Partial<LocalMedia>) => {
    localRef.current = { ...localRef.current, ...patch }
    setLocalState(localRef.current)
  }, [])

  const send = useCallback(
    (to: string, payload: Omit<Signal, 'from'>) => socket?.emit('call:signal', { roomId, to, ...payload }),
    [socket, roomId],
  )

  const sendState = useCallback(() => {
    const { mic, cam, screen } = localRef.current
    socket?.emit('call:state', { roomId, mic, cam, sharing: !!screen, ...(screen && { screenId: screen.id }) })
  }, [socket, roomId])

  /** Works out which of a peer's streams is the camera and which the screen. */
  const refreshStreams = useCallback((id: string) => {
    setPeers((prev) => {
      const peer = prev[id]
      const link = links.current.get(id)
      if (!peer || !link) return prev
      const screen = (peer.sharing && peer.screenId && link.streams.get(peer.screenId)) || null
      const camera = [...link.streams.values()].find((s) => s.id !== peer.screenId) ?? null
      return { ...prev, [id]: { ...peer, camera, screen } }
    })
  }, [])

  const dropLink = useCallback((id: string) => {
    links.current.get(id)?.pc.close()
    links.current.delete(id)
    setPeers((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const createLink = useCallback(
    (info: PeerInfo) => {
      if (!socket?.id || links.current.has(info.socketId)) return
      const pc = new RTCPeerConnection({ iceServers: iceServers.current ?? [] })
      const link: Link = {
        pc,
        // Exactly one side of each pair is polite: it gives way when both
        // offer at once.
        polite: socket.id > info.socketId,
        makingOffer: false,
        ignoreOffer: false,
        chain: Promise.resolve(),
        streams: new Map(),
        screenSenders: [],
      }
      links.current.set(info.socketId, link)
      setPeers((prev) => ({ ...prev, [info.socketId]: { ...info, camera: null, screen: null, connection: 'new' } }))

      const { camera, screen } = localRef.current
      camera?.getTracks().forEach((t) => pc.addTrack(t, camera))
      // Always ask to receive both, so a person without a camera still
      // connects and sees the others.
      if (!camera?.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' })
      if (!camera?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' })
      screen?.getTracks().forEach((t) => link.screenSenders.push(pc.addTrack(t, screen)))

      pc.onnegotiationneeded = async () => {
        try {
          link.makingOffer = true
          await pc.setLocalDescription()
          if (pc.localDescription) send(info.socketId, { description: pc.localDescription.toJSON() })
        } catch (err) {
          console.warn('Call: could not make an offer', err)
        } finally {
          link.makingOffer = false
        }
      }
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) send(info.socketId, { candidate: candidate.toJSON() })
      }
      pc.ontrack = ({ track, streams }) => {
        const stream = streams[0] ?? new MediaStream([track])
        link.streams.set(stream.id, stream)
        stream.onremovetrack = () => {
          if (stream.getTracks().length === 0) {
            link.streams.delete(stream.id)
            refreshStreams(info.socketId)
          }
        }
        refreshStreams(info.socketId)
      }
      pc.onconnectionstatechange = () => {
        setPeers((prev) =>
          prev[info.socketId]
            ? { ...prev, [info.socketId]: { ...prev[info.socketId], connection: pc.connectionState } }
            : prev,
        )
        // A network change broke the path: find a new one.
        if (pc.connectionState === 'failed') pc.restartIce()
      }
    },
    [socket, send, refreshStreams],
  )

  const handleSignal = useCallback(
    ({ from, description, candidate }: Signal) => {
      const link = links.current.get(from)
      if (!link) return
      link.chain = link.chain.then(async () => {
        const { pc } = link
        try {
          if (description) {
            const collision = description.type === 'offer' && (link.makingOffer || pc.signalingState !== 'stable')
            link.ignoreOffer = !link.polite && collision
            if (link.ignoreOffer) return
            await pc.setRemoteDescription(description)
            if (description.type === 'offer') {
              await pc.setLocalDescription()
              if (pc.localDescription) send(from, { description: pc.localDescription.toJSON() })
            }
          } else if (candidate) {
            await pc.addIceCandidate(candidate)
          }
        } catch (err) {
          if (!link.ignoreOffer) console.warn('Call: signal failed', err)
        }
      })
    },
    [send],
  )

  const closeAll = useCallback(() => {
    links.current.forEach((link) => link.pc.close())
    links.current.clear()
    setPeers({})
    joinedRef.current = false
    setJoined(false)
  }, [])

  const stopMedia = useCallback(() => {
    const { camera, screen } = localRef.current
    camera?.getTracks().forEach((t) => t.stop())
    screen?.getTracks().forEach((t) => t.stop())
    setLocal(NO_MEDIA)
  }, [setLocal])

  const join = useCallback(async () => {
    if (!socket || !inRoom || joinedRef.current) return
    wanted.current = true
    setJoining(true)
    try {
      iceServers.current ??= (await getIceServers(roomId)).iceServers
      if (!localRef.current.camera) setLocal({ camera: await getMedia() })
      const ack = (await socket.timeout(8_000).emitWithAck('call:join', { roomId })) as { peers: PeerInfo[] }
      joinedRef.current = true
      setJoined(true)
      ack.peers.forEach(createLink)
      sendState()
    } catch {
      // A refusal (a full call) arrives as a socket error, which the room
      // shows; here the wait just ends.
      wanted.current = false
    } finally {
      setJoining(false)
    }
  }, [socket, inRoom, roomId, createLink, sendState, setLocal])

  const leave = useCallback(() => {
    wanted.current = false
    if (joinedRef.current) socket?.emit('call:leave', { roomId })
    closeAll()
    stopMedia()
  }, [socket, roomId, closeAll, stopMedia])

  const toggleMic = useCallback(() => {
    const mic = !localRef.current.mic
    localRef.current.camera?.getAudioTracks().forEach((t) => (t.enabled = mic))
    setLocal({ mic })
    sendState()
  }, [setLocal, sendState])

  const toggleCam = useCallback(() => {
    const cam = !localRef.current.cam
    localRef.current.camera?.getVideoTracks().forEach((t) => (t.enabled = cam))
    setLocal({ cam })
    sendState()
  }, [setLocal, sendState])

  const stopShare = useCallback(() => {
    const { screen } = localRef.current
    if (!screen) return
    links.current.forEach((link) => {
      link.screenSenders.forEach((s) => link.pc.removeTrack(s))
      link.screenSenders = []
    })
    screen.getTracks().forEach((t) => t.stop())
    setLocal({ screen: null })
    sendState()
  }, [setLocal, sendState])

  const startShare = useCallback(async () => {
    if (localRef.current.screen) return
    let screen: MediaStream
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false })
    } catch {
      return // The person cancelled the picker.
    }
    const [track] = screen.getVideoTracks()
    // The browser's own "Stop sharing" button.
    track.onended = () => stopShare()
    setLocal({ screen })
    // The id first, so the others know this video is the screen.
    sendState()
    links.current.forEach((link) => link.screenSenders.push(link.pc.addTrack(track, screen)))
  }, [setLocal, sendState, stopShare])

  /** Swaps the camera or microphone without renegotiating. */
  const switchDevice = useCallback(
    async (kind: 'audio' | 'video', deviceId: string) => {
      const camera = localRef.current.camera
      if (!camera) return
      const fresh = await navigator.mediaDevices.getUserMedia(
        kind === 'audio' ? { audio: { deviceId: { exact: deviceId } } } : { video: { deviceId: { exact: deviceId } } },
      )
      const [track] = kind === 'audio' ? fresh.getAudioTracks() : fresh.getVideoTracks()
      track.enabled = kind === 'audio' ? localRef.current.mic : localRef.current.cam
      const old = kind === 'audio' ? camera.getAudioTracks()[0] : camera.getVideoTracks()[0]
      await Promise.all(
        [...links.current.values()].flatMap(({ pc }) =>
          pc.getSenders().flatMap((s) => (old && s.track === old ? [s.replaceTrack(track)] : [])),
        ),
      )
      if (old) {
        camera.removeTrack(old)
        old.stop()
      }
      camera.addTrack(track)
      // A new object, so the preview re-renders with the new track.
      setLocal({ camera: new MediaStream(camera.getTracks()) })
    },
    [setLocal],
  )

  // Messages from the server.
  useEffect(() => {
    if (!socket) return
    const onJoined = (info: PeerInfo) => {
      if (joinedRef.current) createLink(info)
    }
    const onLeft = ({ socketId }: { socketId: string }) => dropLink(socketId)
    const onState = (state: PeerInfo) => {
      setPeers((prev) => {
        const peer = prev[state.socketId]
        if (!peer) return prev
        // A finished screen share's stream is gone for good.
        if (peer.screenId && peer.screenId !== state.screenId) {
          links.current.get(state.socketId)?.streams.delete(peer.screenId)
        }
        return { ...prev, [state.socketId]: { ...peer, ...state } }
      })
      refreshStreams(state.socketId)
    }
    const onReplaced = () => {
      wanted.current = false
      closeAll()
      stopMedia()
      toast.info('You joined this call from another tab.')
    }
    // The server forgets the call when the socket drops; it is joined again
    // once the room is back (below).
    const onDisconnect = () => closeAll()

    socket.on('call:peer-joined', onJoined)
    socket.on('call:peer-left', onLeft)
    socket.on('call:signal', handleSignal)
    socket.on('call:state', onState)
    socket.on('call:replaced', onReplaced)
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('call:peer-joined', onJoined)
      socket.off('call:peer-left', onLeft)
      socket.off('call:signal', handleSignal)
      socket.off('call:state', onState)
      socket.off('call:replaced', onReplaced)
      socket.off('disconnect', onDisconnect)
    }
  }, [socket, createLink, dropLink, handleSignal, refreshStreams, closeAll, stopMedia])

  // Back in the room after a reconnect: rejoin if the person was in the call.
  useEffect(() => {
    if (inRoom && wanted.current && !joinedRef.current) void join()
  }, [inRoom, join])

  // The room ended: hang up and release the camera.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (ended) leave()
  }, [ended, leave])

  // Leaving the page ends the call and turns the camera off.
  const leaveRef = useRef(leave)
  useEffect(() => {
    leaveRef.current = leave
  })
  useEffect(() => () => leaveRef.current(), [])

  return {
    joined,
    joining,
    local,
    peers: Object.values(peers),
    join,
    leave,
    toggleMic,
    toggleCam,
    startShare,
    stopShare,
    switchDevice,
  }
}
