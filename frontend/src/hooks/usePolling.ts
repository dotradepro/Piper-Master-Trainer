import { useEffect, useRef } from 'react'

export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs: number,
  enabled = true
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    let active = true
    const poll = async () => {
      if (!active) return
      try {
        await callbackRef.current()
      } catch {
        // ignore polling errors
      }
    }

    poll() // initial call
    const id = setInterval(poll, intervalMs)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [intervalMs, enabled])
}
