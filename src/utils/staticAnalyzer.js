// Simple static analysis heuristics for flow graphs
function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function addMissingFieldIssues(issues, node, fields) {
  fields.forEach((field) => {
    if (isBlank(node.data?.[field])) {
      issues.push({
        id: `missing:${node.id}:${field}`,
        type: 'missing-field',
        severity: 'error',
        message: `${node.data?.label || node.id} is missing required ${field}`,
        nodeId: node.id,
      })
    }
  })
}

export function analyzeFlow(nodes = [], edges = []) {
  const issues = []

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map()
  const outgoing = new Map()
  const reverseOutgoing = new Map()
  nodes.forEach((n) => {
    incoming.set(n.id, [])
    outgoing.set(n.id, [])
    reverseOutgoing.set(n.id, [])
  })
  edges.forEach((e) => {
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) return
    outgoing.get(e.source).push(e)
    incoming.get(e.target).push(e)
    reverseOutgoing.get(e.target).push(e)
  })

  const startNodes = nodes.filter((node) => node.type === 'start')
  const endNodes = nodes.filter((node) => node.type === 'end')

  if (startNodes.length !== 1) {
    issues.push({ id: 'start-count', type: 'graph', severity: 'error', message: 'Flow should contain exactly one Start node.' })
  }

  if (endNodes.length < 1) {
    issues.push({ id: 'end-missing', type: 'graph', severity: 'error', message: 'Flow must contain at least one End node.' })
  }

  const reachableFromStart = new Set()
  const visitForward = (nodeId) => {
    if (reachableFromStart.has(nodeId)) return
    reachableFromStart.add(nodeId)
    for (const edge of outgoing.get(nodeId) || []) {
      visitForward(edge.target)
    }
  }

  for (const startNode of startNodes) {
    visitForward(startNode.id)
  }

  const canReachEnd = new Set()
  const visitReverse = (nodeId) => {
    if (canReachEnd.has(nodeId)) return
    canReachEnd.add(nodeId)
    for (const edge of reverseOutgoing.get(nodeId) || []) {
      visitReverse(edge.source)
    }
  }

  for (const endNode of endNodes) {
    visitReverse(endNode.id)
  }

  // Nodes reachable from Start but unable to reach End are effectively dead ends.
  nodes.forEach((node) => {
    if (startNodes.length && reachableFromStart.has(node.id) && !canReachEnd.has(node.id) && node.type !== 'end') {
      issues.push({
        id: `no-end:${node.id}`,
        type: 'graph',
        severity: 'error',
        message: `${node.data?.label || node.id} cannot reach an End node`,
        nodeId: node.id,
      })
    }
  })

  // Disconnected nodes
  nodes.forEach((n) => {
    const type = n.type || ''
    if ((incoming.get(n.id) || []).length === 0 && (outgoing.get(n.id) || []).length === 0) {
      // ignore start/end marker nodes if present
      if (type === 'start' || type === 'end') return
      issues.push({ id: `disconnected:${n.id}`, type: 'disconnected', severity: 'warning', message: `Disconnected node: ${n.data?.label || n.id}`, nodeId: n.id })
    }
  })

  // Self-loop edges -> infinite loop risk
  edges.forEach((e) => {
    if (e.source === e.target) {
      issues.push({ id: `selfloop:${e.source}`, type: 'selfloop', severity: 'error', message: `Self-loop detected on node ${e.source}` })
    }
  })

  // Required node fields by node type
  nodes.forEach((node) => {
    switch (node.type) {
      case 'input':
        addMissingFieldIssues(issues, node, ['variableName', 'value'])
        break
      case 'condition':
        addMissingFieldIssues(issues, node, ['left', 'operator', 'right'])
        break
      case 'math':
        addMissingFieldIssues(issues, node, ['target', 'left', 'operator', 'right'])
        break
      case 'for-loop':
        addMissingFieldIssues(issues, node, ['counter', 'start', 'step'])
        if ((node.data?.forLoopMode ?? (node.data?.left || node.data?.operator || node.data?.right ? 'coder' : 'simple')) === 'simple') {
          addMissingFieldIssues(issues, node, ['end'])
        } else {
          addMissingFieldIssues(issues, node, ['left', 'operator', 'right'])
        }
        if (node.data?.operator && !['<', '<=', '>', '>='].includes(node.data.operator)) {
          issues.push({ id: `bad-op:${node.id}`, type: 'missing-field', severity: 'error', message: `${node.data?.label || node.id} has an invalid loop comparison operator`, nodeId: node.id })
        }
        if (String(node.data?.step ?? '').trim() === '0') {
          issues.push({ id: `bad-step:${node.id}`, type: 'cycle', severity: 'error', message: `${node.data?.label || node.id} cannot use a step value of 0`, nodeId: node.id })
        }
        break
      case 'while-loop':
        addMissingFieldIssues(issues, node, ['condition', 'counter'])
        break
      case 'delay':
        addMissingFieldIssues(issues, node, ['milliseconds'])
        break
      case 'api':
        addMissingFieldIssues(issues, node, ['url', 'method', 'saveTo'])
        break
      case 'output':
        addMissingFieldIssues(issues, node, ['value'])
        break
      default:
        break
    }
  })

  // Unused outputs heuristic: node declares outputs but has no outgoing edges
  nodes.forEach((n) => {
    if (n.data && Array.isArray(n.data.outputs) && n.data.outputs.length > 0) {
      if ((outgoing.get(n.id) || []).length === 0) {
        issues.push({ id: `unused:${n.id}`, type: 'unused', severity: 'warning', message: `Unused outputs from ${n.data?.label || n.id}`, nodeId: n.id })
      }
    }
  })

  // Cycle detection using DFS for infinite loop risk
  const visited = new Set()
  const onStack = new Set()
  const stackPath = []
  let foundCycle = false

  function dfs(nodeId) {
    if (foundCycle) return
    visited.add(nodeId)
    onStack.add(nodeId)
    stackPath.push(nodeId)
    const outs = outgoing.get(nodeId) || []
    for (const e of outs) {
      const tgt = e.target
      if (!visited.has(tgt)) dfs(tgt)
      else if (onStack.has(tgt)) {
        const cycleStartIndex = stackPath.indexOf(tgt)
        const cycleNodes = cycleStartIndex >= 0 ? stackPath.slice(cycleStartIndex) : [tgt]
        const cycleCanReachEnd = cycleNodes.some((id) => canReachEnd.has(id))
        if (!cycleCanReachEnd) {
          issues.push({
            id: `cycle:${cycleNodes.join('>')}`,
            type: 'cycle',
            severity: 'error',
            message: `Potential infinite loop: cycle cannot reach an End node (${cycleNodes.map((id) => nodeMap.get(id)?.data?.label || id).join(' → ')})`,
          })
          foundCycle = true
        }
        return
      }
    }
    stackPath.pop()
    onStack.delete(nodeId)
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) dfs(n.id)
    if (foundCycle) break
  }

  if (!foundCycle) {
    const cycleOnlyIssues = issues.some((issue) => issue.type === 'cycle')
    if (!cycleOnlyIssues) {
      // harmless cycle can still be a warning, but only if it exists on a path that can finish.
      const hasAnyCycle = edges.some((edge) => reachableFromStart.has(edge.source) && reachableFromStart.has(edge.target) && outgoing.get(edge.target)?.some((nextEdge) => nextEdge.target === edge.source))
      if (hasAnyCycle) {
        issues.push({ id: 'cycle-warning', type: 'cycle', severity: 'warning', message: 'Potential cycle detected. Verify that it can exit to an End node.' })
      }
    }
  }

  return issues
}

export default analyzeFlow
