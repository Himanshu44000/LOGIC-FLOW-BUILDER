import FlowNode from './FlowNode'

export const nodeTypes = {
  start: FlowNode,
  input: FlowNode,
  condition: FlowNode,
  output: FlowNode,
  delay: FlowNode,
  math: FlowNode,
  'for-loop': FlowNode,
  'while-loop': FlowNode,
  api: FlowNode,
  end: FlowNode,
}
