import { useEffect, useRef } from 'react'

export function useAutosave(callback, delayMs = 10000) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const timer = setInterval(() => {
      callbackRef.current?.()
    }, delayMs)

    return () => clearInterval(timer)
  }, [delayMs])
}
