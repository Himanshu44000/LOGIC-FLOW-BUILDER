const FLOW_ID = 'e759fcd7-f8f0-47ca-99c7-eec9eff5568f'
const API_BASE = 'http://localhost:4000/api'

async function main(){
  console.log('Fetching flow', FLOW_ID)
  const flowRes = await fetch(`${API_BASE}/flows/${FLOW_ID}`)
  if (!flowRes.ok) throw new Error('Failed to fetch flow: '+flowRes.status)
  const flow = await flowRes.json()
  console.log('Flow nodes:', flow.nodes.length, 'edges:', flow.edges.length)

  const runRes = await fetch(`${API_BASE}/executions/run`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ flowId: FLOW_ID, nodes: flow.nodes, edges: flow.edges, speedMs: 0 })
  })

  if (!runRes.ok) {
    console.error('Run failed', runRes.status)
    const txt = await runRes.text()
    console.error(txt)
    return
  }

  const result = await runRes.json()
  console.log('Run result keys:', Object.keys(result))
  console.log('Recording length:', Array.isArray(result.recording) ? result.recording.length : 'no recording')
  if (Array.isArray(result.recording)) console.log('First step sample:', result.recording[0])
}

main().catch(err=>{console.error(err); process.exit(1)})
