const runs = new Map()

export function createRun(runId) {
  const control = {
    paused: false,
    breakpoints: new Set(),
    _waiter: null,
    _resolve: null,
    stopped: false,
  }
  runs.set(runId, control)
  return control
}

export function getRun(runId) {
  return runs.get(runId)
}

export function removeRun(runId) {
  runs.delete(runId)
}

export function setBreakpoint(runId, nodeId) {
  const r = runs.get(runId)
  if (!r) return false
  r.breakpoints.add(nodeId)
  return true
}

export function clearBreakpoints(runId) {
  const r = runs.get(runId)
  if (!r) return false
  r.breakpoints.clear()
  return true
}

export function signalRun(runId, action) {
  const r = runs.get(runId)
  if (!r) return false
  if (action === 'pause') r.paused = true
  if (action === 'continue') r.paused = false
  if (action === 'stop') r.stopped = true
  if (action === 'step') {
    // step: allow one node then re-pause
    r.paused = false
    if (typeof r._resolve === 'function') {
      r._resolve({ action: 'step' })
    }
    return true
  }

  if (typeof r._resolve === 'function') {
    r._resolve({ action: action })
  }

  return true
}

export function waitForResume(runId) {
  const r = runs.get(runId)
  if (!r) return Promise.resolve({ action: 'continue' })
  if (!r.paused && !r._waiter) return Promise.resolve({ action: 'continue' })

  if (r._waiter) return r._waiter

  r._waiter = new Promise((resolve) => {
    r._resolve = (payload) => {
      r._waiter = null
      r._resolve = null
      resolve(payload)
    }
  })

  return r._waiter
}
