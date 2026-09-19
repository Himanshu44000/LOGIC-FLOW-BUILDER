import { getRun, signalRun, setBreakpoint, clearBreakpoints } from '../services/runManager.js'

export async function controlRun(req, res, next) {
  try {
    const { runId } = req.params
    const { action, nodeId, breakpoints } = req.body

    const run = getRun(runId)
    if (!run) return res.status(404).json({ message: 'Run not found' })

    if (action === 'setBreakpoint' && nodeId) {
      setBreakpoint(runId, nodeId)
      return res.json({ ok: true })
    }

    if (action === 'clearBreakpoints') {
      clearBreakpoints(runId)
      return res.json({ ok: true })
    }

    if (Array.isArray(breakpoints)) {
      // replace breakpoints
      clearBreakpoints(runId)
      for (const b of breakpoints) setBreakpoint(runId, b)
    }

    // actions: pause, continue, step, stop
    if (['pause', 'continue', 'step', 'stop'].includes(action)) {
      signalRun(runId, action)
      return res.json({ ok: true })
    }

    return res.status(400).json({ message: 'Unknown action' })
  } catch (error) {
    next(error)
  }
}

export async function getRunStatus(req, res, next) {
  try {
    const { runId } = req.params
    const run = getRun(runId)
    if (!run) return res.status(404).json({ message: 'Run not found' })

    return res.json({ paused: run.paused, breakpoints: Array.from(run.breakpoints || []), stopped: run.stopped })
  } catch (error) {
    next(error)
  }
}
