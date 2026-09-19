const LANGUAGE_CONFIG = {
  javascript: { label: 'JavaScript', extension: 'js' },
  typescript: { label: 'TypeScript', extension: 'ts' },
  python: { label: 'Python', extension: 'py' },
  java: { label: 'Java', extension: 'java' },
  cpp: { label: 'C++', extension: 'cpp' },
}

export const CODE_LANGUAGE_OPTIONS = Object.entries(LANGUAGE_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  extension: config.extension,
}))

function indent(level) {
  return '  '.repeat(level)
}

function commentLine(language, text) {
  return language === 'python' ? `# ${text}` : `// ${text}`
}

function sanitizeIdentifier(value, fallback = 'GeneratedFlow') {
  const cleaned = String(value ?? '')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^([0-9])/, '_$1')

  return cleaned || fallback
}

function formatExpression(raw) {
  if (raw === null || raw === undefined || raw === '') return 'null'
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)

  const value = String(raw).trim()
  if (!value) return 'null'

  if (value.startsWith('{{') && value.endsWith('}}')) {
    return value.slice(2, -2).trim() || 'null'
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) return value
  if (/^(true|false)$/i.test(value)) return value.toLowerCase()
  if (/^[A-Za-z_$][\w$]*$/.test(value)) return value

  return JSON.stringify(value)
}

function formatJavaInitializer(raw) {
  const value = formatExpression(raw)
  return value === 'null' ? 'null' : value
}

function formatCppInitializer(raw) {
  const value = formatExpression(raw)
  return value === 'null' ? 'std::string()' : value
}

function inferLiteralKind(raw) {
  if (raw === null || raw === undefined || raw === '') return 'unknown'

  if (typeof raw === 'boolean') return 'boolean'
  if (typeof raw === 'number') return Number.isInteger(raw) ? 'int' : 'double'

  const value = String(raw).trim()
  if (!value) return 'unknown'
  if (/^(true|false)$/i.test(value)) return 'boolean'
  if (/^-?\d+$/.test(value)) return 'int'
  if (/^-?\d*\.\d+$/.test(value)) return 'double'
  if (value.startsWith('{{') && value.endsWith('}}')) return 'unknown'
  return 'string'
}

function inferMathKind(node) {
  const operator = node.data?.operator ?? '+'
  if (operator === '/') return 'double'

  const leftKind = inferLiteralKind(node.data?.left)
  const rightKind = inferLiteralKind(node.data?.right)
  if (leftKind === 'double' || rightKind === 'double') return 'double'
  if (leftKind === 'int' && rightKind === 'int') return 'int'
  return 'double'
}

function getJavaType(kind) {
  switch (kind) {
    case 'int':
      return 'int'
    case 'double':
      return 'double'
    case 'boolean':
      return 'boolean'
    default:
      return 'String'
  }
}

function getCppType(kind) {
  switch (kind) {
    case 'int':
      return 'int'
    case 'double':
      return 'double'
    case 'boolean':
      return 'bool'
    default:
      return 'std::string'
  }
}

function buildTypedInitializer(language, kind, value, fallback = 'null') {
  if (language === 'java') {
    const javaType = getJavaType(kind)
    if (javaType === 'String') return { type: javaType, initializer: value === 'null' ? '""' : value }
    if (javaType === 'boolean') return { type: javaType, initializer: value === 'null' ? 'false' : value }
    if (javaType === 'double') return { type: javaType, initializer: value === 'null' ? '0.0' : value }
    return { type: javaType, initializer: value === 'null' ? '0' : value }
  }

  const cppType = getCppType(kind)
  if (cppType === 'std::string') return { type: cppType, initializer: value === 'null' ? 'std::string()' : value }
  if (cppType === 'bool') return { type: cppType, initializer: value === 'null' ? 'false' : value }
  if (cppType === 'double') return { type: cppType, initializer: value === 'null' ? '0.0' : value }
  return { type: cppType, initializer: value === 'null' ? '0' : value }
}

function hasStringUsage(nodes) {
  return nodes.some((node) => {
    if (node.type === 'input') return inferLiteralKind(node.data?.value) === 'string'
    if (node.type === 'output') return inferLiteralKind(node.data?.value) === 'string'
    if (node.type === 'api') {
      return inferLiteralKind(node.data?.body) === 'string' || inferLiteralKind(node.data?.saveTo) === 'string'
    }
    return false
  })
}

function getGraphIndex(nodes, edges) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const outgoingBySource = new Map()

  for (const edge of edges) {
    const bucket = outgoingBySource.get(edge.source) ?? []
    bucket.push(edge)
    outgoingBySource.set(edge.source, bucket)
  }

  return { nodeById, outgoingBySource }
}

function getOutgoingEdge(outgoingBySource, nodeId, handle) {
  const edges = outgoingBySource.get(nodeId) ?? []
  if (handle) {
    const matched = edges.find((edge) => edge.sourceHandle === handle)
    if (matched) return matched
  }

  return edges[0] ?? null
}

function getNextNodeId(outgoingBySource, nodeId) {
  return getOutgoingEdge(outgoingBySource, nodeId)?.target ?? null
}

function collectReachableNodes(startId, graph) {
  const seen = new Set()
  const queue = [startId]

  while (queue.length) {
    const nodeId = queue.shift()
    if (!nodeId || seen.has(nodeId)) continue

    seen.add(nodeId)
    const edges = graph.outgoingBySource.get(nodeId) ?? []
    for (const edge of edges) queue.push(edge.target)
  }

  return seen
}

function collectNodesThatReach(targetId, graph) {
  const incoming = new Map()
  for (const [source, edges] of graph.outgoingBySource.entries()) {
    for (const edge of edges) {
      const arr = incoming.get(edge.target) ?? []
      arr.push(edge.source)
      incoming.set(edge.target, arr)
    }
  }

  const seen = new Set()
  const queue = [targetId]
  while (queue.length) {
    const id = queue.shift()
    if (!id || seen.has(id)) continue
    seen.add(id)
    const preds = incoming.get(id) ?? []
    for (const p of preds) queue.push(p)
  }

  return seen
}

function findMergeNode(trueStartId, falseStartId, graph) {
  if (!trueStartId || !falseStartId) return null

  const trueReachable = collectReachableNodes(trueStartId, graph)
  const falseReachable = collectReachableNodes(falseStartId, graph)

  for (const nodeId of trueReachable) {
    if (falseReachable.has(nodeId)) return nodeId
  }

  return null
}

function buildExpression(language, raw) {
  const value = formatExpression(raw)

  if (language === 'python') {
    if (value === 'null') return 'None'
    if (value === 'true') return 'True'
    if (value === 'false') return 'False'
  }

  return value
}

function buildLogLine(language, expression) {
  switch (language) {
    case 'python':
      return `print(${expression})`
    case 'java':
      return `System.out.println(${expression});`
    case 'cpp':
      return `std::cout << ${expression} << std::endl;`
    default:
      return `console.log(${expression});`
  }
}

function buildDelayLine(language, milliseconds) {
  const value = Number(milliseconds ?? 0)

  switch (language) {
    case 'python':
      return `time.sleep(${(value / 1000).toFixed(3).replace(/\.000$/, '')})`
    case 'java':
      return `Thread.sleep(${Math.max(0, Math.round(value))});`
    case 'cpp':
      return `std::this_thread::sleep_for(std::chrono::milliseconds(${Math.max(0, Math.round(value))}));`
    default:
      return `await sleep(${Math.max(0, Math.round(value))});`
  }
}

function buildApiStatement(language, node) {
  const method = String(node.data?.method ?? 'GET').toUpperCase()
  const url = buildExpression(language, node.data?.url)
  const body = buildExpression(language, node.data?.body)
  const saveTo = sanitizeIdentifier(node.data?.saveTo ?? 'apiResponse', 'apiResponse')

  switch (language) {
    case 'python':
      return [
        `response = requests.request(method=${JSON.stringify(method)}, url=${url}, json=${body === 'None' ? 'None' : body})`,
        `${saveTo} = response.json()`,
      ]

    case 'java':
      return [`var ${saveTo} = request(${JSON.stringify(method)}, ${url}, ${body === 'null' ? 'null' : body});`]

    case 'cpp':
      return [`auto ${saveTo} = request(${JSON.stringify(method)}, ${url}, ${body === 'null' ? 'std::string()' : body});`]

    default:
      return [
        `const response = await fetch(${url}, {`,
        `${indent(1)}method: ${JSON.stringify(method)},`,
        `${indent(1)}headers: { 'Content-Type': 'application/json' },`,
        body !== 'null' ? `${indent(1)}body: JSON.stringify(${body}),` : null,
        `});`,
        `const ${saveTo} = await response.json();`,
      ].filter(Boolean)
  }
}

function emitNode(node, graph, language, depth, warnings, declared = new Set(), stopNodeId = null) {
  const data = node.data ?? {}

  switch (node.type) {
    case 'start':
      return [`${indent(depth)}${commentLine(language, 'Start')}`]

    case 'input': {
      const variableName = sanitizeIdentifier(data.variableName, 'value')
      const value = language === 'python'
        ? buildExpression(language, data.value)
        : language === 'java'
          ? formatJavaInitializer(data.value)
          : language === 'cpp'
            ? formatCppInitializer(data.value)
            : buildExpression(language, data.value)
      const kind = inferLiteralKind(data.value)

      switch (language) {
        case 'python':
          declared.add(variableName)
          return [`${indent(depth)}${variableName} = ${value}`]
        case 'java':
          {
            const typed = buildTypedInitializer(language, kind, value)
            declared.add(variableName)
            return [`${indent(depth)}${typed.type} ${variableName} = ${typed.initializer};`]
          }
        case 'cpp':
          {
            const typed = buildTypedInitializer(language, kind, value)
            declared.add(variableName)
            return [`${indent(depth)}${typed.type} ${variableName} = ${typed.initializer};`]
          }
        default:
          declared.add(variableName)
          return [`${indent(depth)}let ${variableName} = ${value};`]
      }
    }

    case 'math': {
      const target = sanitizeIdentifier(data.target, 'result')
      const left = buildExpression(language, data.left)
      const right = buildExpression(language, data.right)
      const operator = data.operator ?? '+'
      const kind = inferMathKind(node)

      switch (language) {
        case 'python':
          declared.add(target)
          return [`${indent(depth)}${target} = ${left} ${operator} ${right}`]
        case 'java':
          if (!declared.has(target)) {
            declared.add(target)
            return [`${indent(depth)}${getJavaType(kind)} ${target} = ${left} ${operator} ${right};`]
          }
          return [`${indent(depth)}${target} = ${left} ${operator} ${right};`]
        case 'cpp':
          if (!declared.has(target)) {
            declared.add(target)
            return [`${indent(depth)}${getCppType(kind)} ${target} = ${left} ${operator} ${right};`]
          }
          return [`${indent(depth)}${target} = ${left} ${operator} ${right};`]
        default:
          if (!declared.has(target)) {
            declared.add(target)
            return [`${indent(depth)}let ${target} = ${left} ${operator} ${right};`]
          }

          return [`${indent(depth)}${target} = ${left} ${operator} ${right};`]
      }
    }

    case 'delay':
      return [`${indent(depth)}${buildDelayLine(language, data.milliseconds)}`]

    case 'api':
      const lines = buildApiStatement(language, node).map((line) => `${indent(depth)}${line}`)
      const saveTo = sanitizeIdentifier(node.data?.saveTo ?? 'apiResponse', 'apiResponse')
      declared.add(saveTo)
      return lines

    case 'output': {
      const expression = buildExpression(language, data.value)
      return [`${indent(depth)}${buildLogLine(language, expression)}`]
    }

    case 'condition': {
      const left = buildExpression(language, data.left)
      const right = buildExpression(language, data.right)
      const operator = data.operator ?? '=='
      const trueEdge = getOutgoingEdge(graph.outgoingBySource, node.id, 'true')
      const falseEdge = getOutgoingEdge(graph.outgoingBySource, node.id, 'false')
      const mergeNodeId = stopNodeId
        ? null
        : trueEdge?.target && falseEdge?.target
          ? findMergeNode(trueEdge.target, falseEdge.target, graph)
          : null

      const lines = [
        language === 'python'
          ? `${indent(depth)}if ${left} ${operator} ${right}:`
          : `${indent(depth)}if (${left} ${operator} ${right}) {`,
      ]

      const branchStopNodeId = stopNodeId ?? mergeNodeId

      if (trueEdge?.target) {
        lines.push(...emitSequence(trueEdge.target, graph, language, depth + 1, warnings, branchStopNodeId, new Set([node.id]), declared))
      } else {
        lines.push(`${indent(depth + 1)}${commentLine(language, 'No TRUE branch connected')}`)
      }

      lines.push(language === 'python' ? `${indent(depth)}else:` : `${indent(depth)}} else {`)

      if (falseEdge?.target) {
        lines.push(...emitSequence(falseEdge.target, graph, language, depth + 1, warnings, branchStopNodeId, new Set([node.id]), declared))
      } else {
        lines.push(`${indent(depth + 1)}${commentLine(language, 'No FALSE branch connected')}`)
      }

      if (language !== 'python') {
        lines.push(`${indent(depth)}}`)
      }

      if (mergeNodeId && mergeNodeId !== node.id && mergeNodeId !== stopNodeId) {
        lines.push(...emitSequence(mergeNodeId, graph, language, depth, warnings, null, new Set([node.id]), declared))
      }

      return lines
    }

    case 'end':
      switch (language) {
        case 'python':
          return [`${indent(depth)}return`]
        case 'java':
          return [`${indent(depth)}return;`]
        case 'cpp':
          return [`${indent(depth)}return 0;`]
        default:
          return [`${indent(depth)}return;`]
      }

      case 'for-loop': {
        const counter = sanitizeIdentifier(data.counter ?? 'i', 'i')
        const start = buildExpression(language, data.start)
        const forLoopMode = data.forLoopMode ?? (data.left || data.operator || data.right ? 'coder' : 'simple')
        const left = buildExpression(language, forLoopMode === 'simple' ? counter : (data.left ?? counter))
        const right = buildExpression(language, forLoopMode === 'simple' ? (data.end ?? data.right) : (data.right ?? data.end))
        const step = buildExpression(language, data.step ?? '1')
        const stepNum = Number(String(data.step ?? '1'))
        const operator = forLoopMode === 'simple'
          ? (stepNum < 0 ? '>=' : '<=')
          : (['<', '<=', '>', '>='].includes(data.operator) ? data.operator : ['<', '<=', '>', '>='].includes(data.endOperator) ? data.endOperator : (stepNum < 0 ? '>=' : '<='))

        const loopEdge = getOutgoingEdge(graph.outgoingBySource, node.id, 'loop')
        const exitEdge = getOutgoingEdge(graph.outgoingBySource, node.id, 'exit')
        const mergeNodeId = loopEdge?.target && exitEdge?.target ? findMergeNode(loopEdge.target, exitEdge.target, graph) : null

        const lines = []

        const comparator = operator

        switch (language) {
          case 'python': {
            if (!isNaN(stepNum) && stepNum !== 0) {
              const inclusive = comparator === '<=' || comparator === '>='
              const rangeEnd = stepNum > 0 ? (inclusive ? `(${right} + 1)` : right) : (inclusive ? `(${right} - 1)` : right)
              lines.push(`${indent(depth)}for ${counter} in range(${start}, ${rangeEnd}, ${step}):`)
              if (loopEdge?.target) {
                const backReach = collectNodesThatReach(node.id, graph)
                lines.push(...emitSequence(loopEdge.target, graph, language, depth + 1, warnings, node.id, new Set([node.id]), declared, backReach, true))
              } else {
                lines.push(`${indent(depth + 1)}${commentLine(language, 'No loop body connected')}`)
              }
            } else {
              lines.push(`${indent(depth)}${counter} = ${start}`)
              lines.push(`${indent(depth)}while ${left} ${comparator} ${right}:`)
              if (loopEdge?.target) {
                const backReach = collectNodesThatReach(node.id, graph)
                lines.push(...emitSequence(loopEdge.target, graph, language, depth + 1, warnings, node.id, new Set([node.id]), declared, backReach, true))
              } else {
                lines.push(`${indent(depth + 1)}${commentLine(language, 'No loop body connected')}`)
              }
              lines.push(`${indent(depth + 1)}${counter} = ${counter} + ${step}`)
            }
            break
          }

          case 'java':
          case 'cpp':
          case 'typescript':
          case 'javascript':
          default: {
            const decl = language === 'java' ? 'int' : language === 'cpp' ? 'int' : 'let'
            lines.push(`${indent(depth)}for (${decl} ${counter} = ${start}; ${left} ${comparator} ${right}; ${counter} += ${step}) {`)
            if (loopEdge?.target) {
              const backReach = collectNodesThatReach(node.id, graph)
              lines.push(...emitSequence(loopEdge.target, graph, language, depth + 1, warnings, node.id, new Set([node.id]), declared, backReach, true))
            } else {
              lines.push(`${indent(depth + 1)}${commentLine(language, 'No loop body connected')}`)
            }
            lines.push(`${indent(depth)}}`)
            break
          }
        }

        if (mergeNodeId && mergeNodeId !== node.id) {
          lines.push(...emitSequence(mergeNodeId, graph, language, depth, warnings, null, new Set([node.id]), declared))
        }

        return lines
      }

      case 'while-loop': {
        const conditionRaw = data.condition ?? 'true'
        const condition = conditionRaw
        const loopEdge = getOutgoingEdge(graph.outgoingBySource, node.id, 'loop')
        const exitEdge = getOutgoingEdge(graph.outgoingBySource, node.id, 'exit')
        const mergeNodeId = loopEdge?.target && exitEdge?.target ? findMergeNode(loopEdge.target, exitEdge.target, graph) : null

        const lines = []
        switch (language) {
          case 'python':
            lines.push(`${indent(depth)}while ${condition}:`)
            if (loopEdge?.target) {
              lines.push(...emitSequence(loopEdge.target, graph, language, depth + 1, warnings, node.id, new Set([node.id]), declared))
            } else {
              lines.push(`${indent(depth + 1)}${commentLine(language, 'No loop body connected')}`)
            }
            break

          case 'java':
          case 'cpp':
          case 'typescript':
          case 'javascript':
          default:
            lines.push(`${indent(depth)}while (${condition}) {`)
            if (loopEdge?.target) {
              const backReach = collectNodesThatReach(node.id, graph)
              lines.push(...emitSequence(loopEdge.target, graph, language, depth + 1, warnings, node.id, new Set([node.id]), declared, backReach, true))
            } else {
              lines.push(`${indent(depth + 1)}${commentLine(language, 'No loop body connected')}`)
            }
            lines.push(`${indent(depth)}}`)
            break
        }

        if (mergeNodeId && mergeNodeId !== node.id) {
          lines.push(...emitSequence(mergeNodeId, graph, language, depth, warnings, null, new Set([node.id]), declared))
        }

        return lines
      }

    default:
      warnings.push(`Unsupported node type: ${node.type}`)
      return [`${indent(depth)}${commentLine(language, `Unsupported node type: ${node.type}`)}`]
  }
}

function emitSequence(startNodeId, graph, language, depth, warnings, stopNodeId = null, activePath = new Set(), declared = new Set(), stopSet = null, allowStartEvenIfInStopSet = false) {
  // Track call depth to prevent runaway recursive calls that can overflow the stack
  emitSequence._depth = (emitSequence._depth || 0) + 1
  if (emitSequence._depth > 200) {
    const lines = []
    warnings.push('Generation aborted: recursion depth exceeded (possible cycle).')
    lines.push(`${indent(depth)}${commentLine(language, 'Generation aborted: recursion depth exceeded')}`)
    emitSequence._depth -= 1
    return lines
  }
  const lines = []
  let currentNodeId = startNodeId
  const path = new Set(activePath)

  // Safety: prevent runaway recursion/very deep generation for graphs with complex cycles
  if (path.size > 500) {
    warnings.push('Generation aborted: too many nested nodes (possible cycle).')
    lines.push(`${indent(depth)}${commentLine(language, 'Generation aborted: too many nested nodes')}`)
    return lines
  }

  // Additional guard: stop if nesting/indent depth grows too large
  if (depth > 60) {
    warnings.push('Generation aborted: nesting too deep (possible cycle).')
    lines.push(`${indent(depth)}${commentLine(language, 'Generation aborted: nesting too deep')}`)
    return lines
  }

  while (currentNodeId && currentNodeId !== stopNodeId) {
    if (path.has(currentNodeId)) {
      warnings.push(`Cycle detected near node ${currentNodeId}`)
      lines.push(`${indent(depth)}${commentLine(language, 'Cycle detected; generation stopped here.')}`)
      break
    }

    const node = graph.nodeById.get(currentNodeId)
    if (!node) {
      warnings.push(`Missing node: ${currentNodeId}`)
      lines.push(`${indent(depth)}${commentLine(language, `Missing node ${currentNodeId}`)}`)
      break
    }

    path.add(currentNodeId)

    if (node.type === 'condition' || node.type === 'for-loop' || node.type === 'while-loop') {
      lines.push(...emitNode(node, graph, language, depth, warnings, declared, stopNodeId))
      break
    }

    lines.push(...emitNode(node, graph, language, depth, warnings, declared, stopNodeId))

    if (node.type === 'end') {
      break
    }

    // Advance to next node, but avoid following edges that would re-enter nodes
    // in the stopSet (back-edges). This allows emitting the loop body while
    // preventing inlining of the loop header or other back-edge targets.
    const nextNodeId = getNextNodeId(graph.outgoingBySource, currentNodeId)
    if (!nextNodeId) break
    if (nextNodeId === stopNodeId) break

    currentNodeId = nextNodeId
  }

  emitSequence._depth -= 1
  return lines
}

function buildHeader(language, flowName, hasDelay, hasApi, hasOutput, hasStrings) {
  const className = sanitizeIdentifier(flowName, 'GeneratedFlow')

  switch (language) {
    case 'python': {
      const imports = []
      if (hasDelay) imports.push('import time')
      if (hasApi) imports.push('import requests')

      return {
        prelude: imports,
        open: ['def main():'],
        close: ['', 'if __name__ == "__main__":', '  main()'],
      }
    }

    case 'java': {
      const imports = hasApi
        ? ['import java.net.URI;', 'import java.net.http.HttpClient;', 'import java.net.http.HttpRequest;', 'import java.net.http.HttpResponse;', 'import java.time.Duration;']
        : []
      const open = [`public class ${className} {`, '  public static void main(String[] args) throws Exception {']
      const close = ['  }']

      if (hasApi) {
        close.push('', '  private static String request(String method, String url, String body) throws Exception {', '    HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();', '    HttpRequest.Builder builder = HttpRequest.newBuilder()', '      .uri(URI.create(url))', '      .timeout(Duration.ofSeconds(10))', '      .header("Content-Type", "application/json");', '', '    switch (method.toUpperCase()) {', '      case "POST":', '      case "PUT":', '      case "PATCH":', '        builder.method(method.toUpperCase(), HttpRequest.BodyPublishers.ofString(body == null ? "" : body));', '        break;', '      case "DELETE":', '        builder.DELETE();', '        break;', '      default:', '        builder.GET();', '    }', '', '    HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());', '    return response.body();', '  }')
      }

      close.push('}')

      return { prelude: imports, open, close }
    }

    case 'cpp': {
      const imports = []
      if (hasApi || hasStrings) imports.push('#include <string>')
      if (hasApi) imports.push('#include <curl/curl.h>')
      if (hasDelay) imports.push('#include <chrono>', '#include <thread>')
      if (hasOutput) imports.push('#include <iostream>')

      const open = hasApi
        ? [
          '',
          'static std::size_t __curl_write_cb(void* contents, size_t size, size_t nmemb, void* userp) {',
          '  std::string* s = static_cast<std::string*>(userp);',
          '  size_t total = size * nmemb;',
          '  s->append(static_cast<char*>(contents), total);',
          '  return total;',
          '}',
          '',
          'std::string request(const std::string& method, const std::string& url, const std::string& body) {',
          '  CURL* curl = curl_easy_init();',
          '  if (!curl) return std::string();',
          '  std::string response;',
          '  curl_easy_setopt(curl, CURLOPT_URL, url.c_str());',
          '  curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);',
          '  curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);',
          '  curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, __curl_write_cb);',
          '  curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);',
          '  struct curl_slist* headers = nullptr;',
          '  headers = curl_slist_append(headers, "Content-Type: application/json");',
          '  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);',
          '  // Basic method handling',
          '  if (method == "POST") {',
          '    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());',
          '    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)body.size());',
          '  } else if (method == "PUT" || method == "PATCH") {',
          '    curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, method.c_str());',
          '    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.c_str());',
          '    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, (long)body.size());',
          '  } else if (method == "DELETE") {',
          '    curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");',
          '  } else {',
          '    // GET and others: default behavior',
          '  }',
          '  CURLcode res = curl_easy_perform(curl);',
          '  if (res != CURLE_OK) {',
          '    std::cerr << "curl error: " << curl_easy_strerror(res) << std::endl;',
          '    curl_slist_free_all(headers);',
          '    curl_easy_cleanup(curl);',
          '    return std::string();',
          '  }',
          '  curl_slist_free_all(headers);',
          '  curl_easy_cleanup(curl);',
          '  return response;',
          '}',
          '',
          'int main() {',
        ]
        : ['', 'int main() {']

      const close = ['}']
      return { prelude: imports, open, close }
    }

    default: {
      const open = ['async function main() {']
      const close = ['}', '', 'main().catch((error) => {', '  console.error(error)', '})']
      return {
        prelude: hasDelay ? ['const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))'] : [],
        open,
        close,
      }
    }
  }
}

function indentBlock(lines, depth = 1) {
  return lines.map((line) => (line ? `${indent(depth)}${line}` : line))
}

export function generateCodeFromFlow(nodes, edges, language, flowName = 'Generated Flow') {
  const normalizedLanguage = LANGUAGE_CONFIG[language] ? language : 'javascript'
  const graph = getGraphIndex(nodes, edges)
  const warnings = []
  const startNode = nodes.find((node) => node.type === 'start')

  if (!startNode) {
    return {
      code: '// Start node not found.',
      warnings: ['Start node not found.'],
      language: normalizedLanguage,
      extension: LANGUAGE_CONFIG[normalizedLanguage].extension,
    }
  }

  const hasDelay = nodes.some((node) => node.type === 'delay')
  const hasApi = nodes.some((node) => node.type === 'api')
  const hasOutput = nodes.some((node) => node.type === 'output')
  const hasStrings = hasStringUsage(nodes)
  const header = buildHeader(normalizedLanguage, flowName, hasDelay, hasApi, hasOutput, hasStrings)

  const sequence = emitSequence(startNode.id, graph, normalizedLanguage, 0, warnings, null, new Set(), new Set())
  const programLines = [...header.prelude, ...header.open, ...indentBlock(sequence, 1), ...header.close]

  if (normalizedLanguage === 'cpp' && hasApi) {
    warnings.push('C++ API helper uses libcurl. Ensure libcurl is installed and link with -lcurl when compiling (e.g., g++ main.cpp -lcurl). Replace with your preferred HTTP client for production if desired.')
  }

  return {
    code: programLines.join('\n').replace(/\n{3,}/g, '\n\n'),
    warnings: [...new Set(warnings)],
    language: normalizedLanguage,
    extension: LANGUAGE_CONFIG[normalizedLanguage].extension,
  }
}

export function downloadCode(filename, code) {
  const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
