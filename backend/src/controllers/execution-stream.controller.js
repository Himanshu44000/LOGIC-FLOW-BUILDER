import { executePayloadSchema, validateFlowGraph } from '../validators/flow.validator.js'
import { executeFlow } from '../engine/executionEngine.js'
import { randomUUID } from 'crypto'
import { createRun, removeRun, getRun } from '../services/runManager.js'

export async function executeStream(req, res, next) {
  try {
    const payload = executePayloadSchema.parse(req.body)
    const validation = validateFlowGraph(payload.nodes, payload.edges)
    // allow optional runtime-only fields from the raw request body (not in the zod schema)
    const breakpoints = req.body?.breakpoints || []

    if (!validation.isValid) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.errors })
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')

    // Create a run id and register a control object so the client may
    // send pause/continue/step commands during the run.
    const runId = randomUUID()
    const control = createRun(runId)

    // Collect all events during execution
    const events = []

    // Define callback to capture node events
    const onNodeExecute = (event) => {
      // annotate with runId and stream to client
      const annotated = { ...event, runId }
      events.push(annotated)
      res.write(`data: ${JSON.stringify(annotated)}\n\n`)
    }

    try {
      // Run execution with callback and control object
      const result = await executeFlow({
        nodes: payload.nodes,
        edges: payload.edges,
        speedMs: payload.speedMs || 0,
        onNodeExecute,
        control,
        breakpoints,
      })

      // Send final completion event
      const completionEvent = {
        type: 'execution_complete',
        runId,
        result,
        timestamp: Date.now(),
      }
      res.write(`data: ${JSON.stringify(completionEvent)}\n\n`)
    } catch (error) {
      const errorEvent = {
        type: 'execution_error',
        runId,
        error: error.message,
        timestamp: Date.now(),
      }
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
    } finally {
      // Remove run control object
      removeRun(runId)
      // Close the connection
      res.end()
    }
  } catch (error) {
    next(error)
  }
}
