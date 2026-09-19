import axios from 'axios'

const COMPARATORS = {
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a == b,
  '!=': (a, b) => a != b,
}

const LOOP_COMPARATORS = {
  '<': COMPARATORS['<'],
  '<=': COMPARATORS['<='],
  '>': COMPARATORS['>'],
  '>=': COMPARATORS['>='],
}

const MATH_OPERATORS = {
  '+': (a, b) => Number(a) + Number(b),
  '-': (a, b) => Number(a) - Number(b),
  '*': (a, b) => Number(a) * Number(b),
  '/': (a, b) => Number(a) / Number(b),
  '%': (a, b) => Number(a) % Number(b),
}

function wait(ms) {
  if (!ms || ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asValue(raw, variables) {
  if (raw === null || raw === undefined) return raw

  if (typeof raw !== 'string') return raw

  const templateMatch = raw.match(/^\{\{(.+)\}\}$/)
  if (templateMatch) {
    const key = templateMatch[1].trim()
    return variables[key]
  }

  if (Object.hasOwn(variables, raw)) {
    return variables[raw]
  }

  if (!Number.isNaN(Number(raw)) && raw.trim() !== '') {
    return Number(raw)
  }

  if (raw === 'true') return true
  if (raw === 'false') return false

  return raw
}

function parseConditionExpression(expression) {
  const match = expression?.match(/^\s*(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$/)
  if (!match) return null

  return {
    left: match[1],
    operator: match[2],
    right: match[3],
  }
}

function findNextEdge(edges, nodeId, branch) {
  if (branch === 'true') {
    return edges.find((edge) => edge.source === nodeId && edge.sourceHandle === 'true')
  }

  if (branch === 'false') {
    return edges.find((edge) => edge.source === nodeId && edge.sourceHandle === 'false')
  }

  return edges.find((edge) => edge.source === nodeId)
}

export async function executeFlow({ nodes, edges, speedMs = 0, onNodeExecute = null, control = null, breakpoints = [], enableRecording = true }) {
  const startedAt = Date.now()
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const startNode = nodes.find((node) => node.type === 'start')

  if (!startNode) {
    const error = new Error('Start node not found.')
    error.status = 400
    throw error
  }

  // Increase global max steps to allow larger/complex flows to complete.
  // Also keep a reasonably high floor to prevent accidental infinite loops.
  const maxSteps = Math.max(nodes.length * 50, 500)
  let currentNode = startNode
  let steps = 0

  const context = {
    variables: {},
    logs: [],
    outputs: [],
    path: [],
    errors: [],
    visitedCounts: {},
    loopState: {},
  }

  // Recording array: capture each step for execution replay
  const recording = enableRecording ? [] : null

  while (currentNode && steps < maxSteps) {
    steps += 1
    context.path.push(currentNode.id)
    context.visitedCounts[currentNode.id] = (context.visitedCounts[currentNode.id] ?? 0) + 1

    // If a control object was provided, populate its breakpoints from the
    // provided array (the run manager creates a Set by default).
    if (control && Array.isArray(breakpoints)) {
      for (const b of breakpoints) {
        if (!control.breakpoints) control.breakpoints = new Set()
        control.breakpoints.add(b)
      }
    }

    // If run control requests a pause or this node is a breakpoint, pause before executing
    if (control && (control.paused || (control.breakpoints && control.breakpoints.has && control.breakpoints.has(currentNode.id)))) {
      // mark as paused to ensure consistent behavior
      control.paused = true
      if (onNodeExecute && typeof onNodeExecute === 'function') {
        onNodeExecute({
          nodeId: currentNode.id,
          nodeType: currentNode.type,
          nodeLabel: currentNode.data?.label || currentNode.type,
          status: 'paused',
          timestamp: Date.now(),
        })
      }

      // wait until client signals resume/step/stop via control._resolve
      if (!control._waiter) {
        control._waiter = new Promise((resolve) => {
          control._resolve = (payload) => {
            control._waiter = null
            control._resolve = null
            resolve(payload)
          }
        })
      }

      const resumePayload = await control._waiter
      if (resumePayload && resumePayload.action === 'stop') {
        context.logs.push('Execution stopped by user')
        break
      }

      if (resumePayload && resumePayload.action === 'step') {
        // allow this node to execute, then re-pause
        control.paused = true
      } else {
        control.paused = false
      }
    }

    // Use per-node visitation thresholds. Loop nodes may be visited many times;
    // for non-loop nodes keep a conservative cap to detect accidental cycles.
    const visitCount = context.visitedCounts[currentNode.id]
    const isLoopNode = currentNode.type === 'for-loop' || currentNode.type === 'while-loop'
    const nodeCap = isLoopNode ? 1000 : Math.max(50, nodes.length * 2)
    if (visitCount > nodeCap) {
      context.errors.push(`Loop detected near node ${currentNode.data?.label ?? currentNode.id}`)
      break
    }

    // Emit node execution event for real-time streaming
    if (onNodeExecute && typeof onNodeExecute === 'function') {
      onNodeExecute({
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeLabel: currentNode.data?.label || currentNode.type,
        status: 'executing',
        timestamp: Date.now(),
        variables: { ...context.variables },
        logs: [...context.logs],
        outputs: [...context.outputs],
      })
    }

    // Capture step in recording for replay functionality
    if (recording) {
      recording.push({
        stepIndex: recording.length,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeLabel: currentNode.data?.label || currentNode.type,
        status: 'executing',
        timestamp: Date.now(),
        variables: JSON.parse(JSON.stringify(context.variables)), // deep copy
        logs: [...context.logs],
        outputs: [...context.outputs],
      })
    }

    const data = currentNode.data ?? {}
    let nextBranch = null

    switch (currentNode.type) {
      case 'start': {
        context.logs.push('Execution started')
        break
      }

      case 'input': {
        const variableName = data.variableName?.trim()
        if (!variableName) {
          context.errors.push(`Input node ${currentNode.id} is missing variable name`)
          break
        }
        context.variables[variableName] = asValue(data.value, context.variables)
        context.logs.push(`Set ${variableName} = ${String(context.variables[variableName])}`)
        break
      }

      case 'math': {
        const target = data.target?.trim()
        const operator = data.operator
        const left = asValue(data.left, context.variables)
        const right = asValue(data.right, context.variables)
        const operation = MATH_OPERATORS[operator]

        if (!target || !operation) {
          context.errors.push(`Math node ${currentNode.id} is invalid`)
          break
        }

        const result = operation(left, right)
        context.variables[target] = result
        context.logs.push(`Math: ${target} = ${String(left)} ${operator} ${String(right)} => ${String(result)}`)
        break
      }

      case 'condition': {
        let left = data.left
        let operator = data.operator
        let right = data.right

        if (data.expression && (!left || !operator || !right)) {
          const parsed = parseConditionExpression(data.expression)
          if (parsed) {
            left = parsed.left
            operator = parsed.operator
            right = parsed.right
          }
        }

        const comparator = COMPARATORS[operator]
        if (!comparator) {
          context.errors.push(`Condition node ${currentNode.id} has unsupported operator`) 
          nextBranch = 'false'
          break
        }

        const leftValue = asValue(left, context.variables)
        const rightValue = asValue(right, context.variables)
        const result = comparator(leftValue, rightValue)

        context.logs.push(`Condition: ${String(leftValue)} ${operator} ${String(rightValue)} => ${result}`)
        nextBranch = result ? 'true' : 'false'
        break
      }

      case 'for-loop': {
        const counter = data.counter?.trim()
        const start = Number(data.start ?? 0)
        const forLoopMode = data.forLoopMode ?? (data.left || data.operator || data.right ? 'coder' : 'simple')
        const left = forLoopMode === 'simple' ? counter : (data.left ?? counter)
        const operator = forLoopMode === 'simple' ? (Number(data.step ?? 1) < 0 ? '>=' : '<=') : (data.operator?.trim() || data.endOperator?.trim() || '<=')
        const right = forLoopMode === 'simple' ? (data.end ?? data.right) : (data.right ?? data.end)
        const step = Number(data.step ?? 1)
        const comparator = LOOP_COMPARATORS[operator]

        if (!counter) {
          context.errors.push(`For-loop node ${currentNode.id} is missing counter name`)
          break
        }

        if (!comparator) {
          context.errors.push(`For-loop node ${currentNode.id} has invalid loop operator`)
          break
        }

        if (forLoopMode === 'simple' && (right === undefined || right === null || String(right).trim() === '')) {
          context.errors.push(`For-loop node ${currentNode.id} is missing an end value`)
          break
        }

        if (step === 0) {
          context.errors.push(`For-loop node ${currentNode.id} cannot use a step of 0`)
          break
        }

        if (!context.loopState[currentNode.id]) {
          context.loopState[currentNode.id] = { currentValue: start }
          context.variables[counter] = start
          context.logs.push(`For-loop: ${counter} = ${start}`)
        } else {
          const state = context.loopState[currentNode.id]
          state.currentValue += step
          context.variables[counter] = state.currentValue
          context.logs.push(`For-loop: ${counter} = ${state.currentValue}`)
        }

        const leftValue = asValue(left, context.variables)
        const rightValue = asValue(right, context.variables)
        const shouldContinue = comparator(leftValue, rightValue)
        if (shouldContinue) {
          nextBranch = 'loop'
        } else {
          delete context.loopState[currentNode.id]
          nextBranch = 'exit'
          context.logs.push(`For-loop: ended when ${String(leftValue)} ${operator} ${String(rightValue)} became false`)
        }
        break
      }

      case 'while-loop': {
        const condition = data.condition?.trim()
        const counter = data.counter?.trim()

        if (!condition || !counter) {
          context.errors.push(`While-loop node ${currentNode.id} is missing condition or counter`)
          break
        }

        if (!context.loopState[currentNode.id]) {
          context.loopState[currentNode.id] = { initialized: true }
          context.logs.push(`While-loop: started with condition "${condition}"`)
        }

        const parsed = parseConditionExpression(condition)
        let shouldContinue = false

        if (parsed) {
          const leftValue = asValue(parsed.left, context.variables)
          const rightValue = asValue(parsed.right, context.variables)
          const comparator = COMPARATORS[parsed.operator]
          shouldContinue = comparator ? comparator(leftValue, rightValue) : false
          context.logs.push(`While-loop: ${String(leftValue)} ${parsed.operator} ${String(rightValue)} => ${shouldContinue}`)
        } else {
          context.logs.push(`While-loop: invalid condition format`)
        }

        if (shouldContinue) {
          nextBranch = 'loop'
        } else {
          delete context.loopState[currentNode.id]
          nextBranch = 'exit'
          context.logs.push(`While-loop: ended`)
        }
        break
      }

      case 'delay': {
        const ms = Number(data.milliseconds ?? 0)
        await wait(ms)
        context.logs.push(`Delay ${ms}ms completed`)
        break
      }

      case 'api': {
        try {
          const response = await axios({
            method: (data.method ?? 'GET').toLowerCase(),
            url: data.url,
            data: data.body ? asValue(data.body, context.variables) : undefined,
            timeout: 10000,
          })

          const saveTo = data.saveTo?.trim()
          if (saveTo) {
            context.variables[saveTo] = response.data
          }

          context.logs.push(`API ${data.method ?? 'GET'} ${data.url} -> ${response.status}`)
        } catch (error) {
          context.errors.push(`API node failed: ${error.message}`)
        }
        break
      }

      case 'output': {
        const raw = data.value ?? data.message ?? ''
        const resolved = asValue(raw, context.variables)
        context.outputs.push(resolved)
        context.logs.push(`Output: ${String(resolved)}`)
        break
      }

      case 'end': {
        context.logs.push('Execution ended')
        currentNode = null
        continue
      }

      default: {
        context.logs.push(`Skipped unsupported node type: ${currentNode.type}`)
      }
    }

    if (context.errors.length > 0) {
      break
    }

    // Emit node completion event
    if (onNodeExecute && typeof onNodeExecute === 'function') {
      onNodeExecute({
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeLabel: currentNode.data?.label || currentNode.type,
        status: 'completed',
        timestamp: Date.now(),
        variables: { ...context.variables },
        logs: [...context.logs],
        outputs: [...context.outputs],
      })
    }

    // Capture completed step in recording for replay functionality
    if (recording) {
      recording.push({
        stepIndex: recording.length,
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        nodeLabel: currentNode.data?.label || currentNode.type,
        status: 'completed',
        timestamp: Date.now(),
        variables: JSON.parse(JSON.stringify(context.variables)), // deep copy
        logs: [...context.logs],
        outputs: [...context.outputs],
      })
    }

    await wait(speedMs)
    const edge = findNextEdge(edges, currentNode.id, nextBranch)
    currentNode = edge ? nodeMap.get(edge.target) : null
  }

  if (steps >= maxSteps) {
    context.errors.push('Execution halted due to safety step limit.')
  }

  return {
    path: context.path,
    logs: context.logs,
    outputs: context.outputs,
    errors: context.errors,
    variables: context.variables,
    executionTime: Date.now() - startedAt,
    recording: recording || [], // include recording array if enabled
  }
}
