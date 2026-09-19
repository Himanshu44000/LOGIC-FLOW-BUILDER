import { useCallback } from 'react'

export function useExecutionStream() {
  const runWithStream = useCallback(async (flowPayload, onNodeEvent, onComplete, onError) => {
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6))

              if (eventData.type === 'execution_complete') {
                console.log('Execution completed', eventData.result)
                onComplete(eventData.result)
              } else if (eventData.type === 'execution_error') {
                console.error('Execution error:', eventData.error)
                onError(eventData.error)
              } else if (eventData.nodeId) {
                // Node execution event
                onNodeEvent(eventData)
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to start execution stream:', error)
      onError(error.message)
    }
  }, [])

  return { runWithStream }
}

