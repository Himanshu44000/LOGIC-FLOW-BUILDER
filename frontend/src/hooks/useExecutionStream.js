import { useCallback } from 'react'

export function useExecutionStream() {
  const runWithStream = useCallback((flowPayload, onNodeEvent, onComplete, onError) => {
    // Start the stream and return a promise that resolves to runId as soon
    // as we observe it. Processing of events continues in background.
    const runIdPromise = new Promise(async (resolveRunId, rejectRun) => {
      try {
        const response = await fetch('/api/executions/run-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(flowPayload),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        let runId = null
        // process stream until end
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const eventData = JSON.parse(line.substring(6))
              // capture and resolve runId as soon as available
              if (!runId && eventData.runId) {
                runId = eventData.runId
                resolveRunId(runId)
              }

              if (eventData.type === 'execution_complete') {
                onComplete?.(eventData.result)
              } else if (eventData.type === 'execution_error') {
                onError?.(eventData.error)
              } else if (eventData.nodeId) {
                onNodeEvent?.(eventData)
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError)
            }
          }
        }

        // if runId wasn't observed in-stream, resolve with null
        if (!runId) resolveRunId(null)
      } catch (err) {
        rejectRun(err)
        onError?.(err.message)
      }
    })

    return runIdPromise
  }, [])

  const sendControl = useCallback(async (runId, body) => {
    if (!runId) throw new Error('runId required')
    const res = await fetch(`/api/executions/${runId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  }, [])

  const pauseRun = useCallback((runId) => sendControl(runId, { action: 'pause' }), [sendControl])
  const continueRun = useCallback((runId) => sendControl(runId, { action: 'continue' }), [sendControl])
  const stepRun = useCallback((runId) => sendControl(runId, { action: 'step' }), [sendControl])
  const stopRun = useCallback((runId) => sendControl(runId, { action: 'stop' }), [sendControl])
  const setBreakpoints = useCallback((runId, breakpoints) => sendControl(runId, { breakpoints }), [sendControl])
  const setBreakpoint = useCallback((runId, nodeId) => sendControl(runId, { action: 'setBreakpoint', nodeId }), [sendControl])

  return { runWithStream, pauseRun, continueRun, stepRun, stopRun, setBreakpoints, setBreakpoint }
}
