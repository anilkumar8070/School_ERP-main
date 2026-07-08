import { useState, useCallback } from 'react'

// useAsyncAction returns [busy, run] where run(fn) runs an async function
// and prevents re-entrance while it's running. Useful to avoid double clicks.
export default function useAsyncAction() {
  const [busy, setBusy] = useState(false)

  const run = useCallback(async (fn) => {
    if (busy) return
    setBusy(true)
    try {
      // Support passing a function or a promise
      if (typeof fn === 'function') {
        const res = fn()
        if (res && typeof res.then === 'function') await res
      } else if (fn && typeof fn.then === 'function') {
        await fn
      }
    } finally {
      setBusy(false)
    }
  }, [busy])

  return [busy, run]
}
