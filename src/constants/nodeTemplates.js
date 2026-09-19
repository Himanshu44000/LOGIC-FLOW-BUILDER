export const NODE_CATALOG = [
  { type: 'start', title: 'Start', color: '#0f766e' },
  { type: 'input', title: 'Input', color: '#0369a1' },
  { type: 'condition', title: 'Condition', color: '#7c3aed' },
  { type: 'math', title: 'Math', color: '#b45309' },
  { type: 'for-loop', title: 'For Loop', color: '#ea580c' },
  { type: 'while-loop', title: 'While Loop', color: '#d97706' },
  { type: 'delay', title: 'Delay', color: '#be123c' },
  { type: 'api', title: 'API Request', color: '#4338ca' },
  { type: 'output', title: 'Output', color: '#15803d' },
  { type: 'end', title: 'End', color: '#334155' },
]

export function defaultDataForType(type) {
  switch (type) {
    case 'start':
      return { label: 'Start' }
    case 'input':
      return { label: 'Input', variableName: 'age', value: '20' }
    case 'condition':
      return { label: 'Condition', left: 'age', operator: '>', right: '18' }
    case 'math':
      return { label: 'Math', target: 'total', left: 'age', operator: '+', right: '5' }
    case 'for-loop':
      return { label: 'For Loop', forLoopMode: 'coder', counter: 'i', start: '0', left: 'i', operator: '<=', right: '5', end: '5', step: '1' }
    case 'while-loop':
      return { label: 'While Loop', condition: 'i < 5', counter: 'i' }
    case 'delay':
      return { label: 'Delay', milliseconds: 1000 }
    case 'api':
      return {
        label: 'API Request',
        url: 'https://jsonplaceholder.typicode.com/todos/1',
        method: 'GET',
        body: '',
        saveTo: 'apiResponse',
      }
    case 'output':
      return { label: 'Output', value: '{{age}}' }
    case 'end':
      return { label: 'End' }
    default:
      return { label: 'Node' }
  }
}

export function createNode(type, position = { x: 300, y: 200 }) {
  return {
    id: crypto.randomUUID(),
    type,
    position,
    data: defaultDataForType(type),
  }
}

export function getNodeMeta(type) {
  return NODE_CATALOG.find((item) => item.type === type) ?? NODE_CATALOG[0]
}
