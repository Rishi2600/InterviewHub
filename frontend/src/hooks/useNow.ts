import { useEffect, useState } from 'react'

/**
 * The current time, ticking every `everyMs`. `offsetMs` corrects a device
 * clock that is off: pass serverTime − deviceTime.
 */
export function useNow(everyMs = 1000, offsetMs = 0): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs)
  useEffect(() => {
    const tick = () => setNow(Date.now() + offsetMs)
    tick()
    const id = window.setInterval(tick, everyMs)
    return () => window.clearInterval(id)
  }, [everyMs, offsetMs])
  return now
}
