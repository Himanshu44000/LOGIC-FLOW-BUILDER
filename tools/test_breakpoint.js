import http from 'http'

async function run() {
  const payload = JSON.stringify({
    nodes: [
      { id: 'start1', type: 'start', data: {} },
      { id: 'm1', type: 'math', data: { target: 'sum', operator: '+', left: '1', right: '2' } },
      { id: 'out1', type: 'output', data: { value: '{{sum}}' } },
      { id: 'end1', type: 'end', data: {} },
    ],
    edges: [
      { source: 'start1', target: 'm1' },
      { source: 'm1', target: 'out1' },
      { source: 'out1', target: 'end1' },
    ],
    breakpoints: ['m1'],
  })

  const req = http.request(
    'http://localhost:4000/api/executions/run-stream',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    },
    (res) => {
      res.setEncoding('utf8')
      let buffer = ''
      res.on('data', (chunk) => {
        buffer += chunk
        let parts = buffer.split('\n\n')
        buffer = parts.pop()
        for (const p of parts) {
          if (!p.startsWith('data:')) continue
          const json = p.replace(/^data:\s*/, '')
          try {
            const obj = JSON.parse(json)
            console.log('EVENT>', obj)
            if (obj.status === 'paused' && obj.runId) {
              // send a step command
              fetch(`http://localhost:4000/api/executions/${obj.runId}/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'step' }),
              }).then(() => console.log('Sent step'))
            }
          } catch (e) {
            console.error('parse error', e)
          }
        }
      })
      res.on('end', () => console.log('SSE ended'))
    }
  )

  req.on('error', (err) => console.error('request error', err))
  req.write(payload)
  req.end()
}

run().catch((e) => console.error(e))
