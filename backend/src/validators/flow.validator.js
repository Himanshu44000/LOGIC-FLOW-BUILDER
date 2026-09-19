import { z } from 'zod'

const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.any()).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
})

const edgeSchema = z.object({
  id: z.string().optional(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
})

export const flowPayloadSchema = z.object({
  name: z.string().min(2).max(120),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
})

export const executePayloadSchema = z.object({
  flowId: z.string().nullable().optional(),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  speedMs: z.number().min(0).max(5000).optional(),
})

export function validateFlowGraph(nodes, edges) {
  const errors = []
  const starts = nodes.filter((node) => node.type === 'start')
  const ends = nodes.filter((node) => node.type === 'end')

  if (starts.length !== 1) {
    errors.push('Flow must contain exactly one Start node.')
  }

  if (ends.length < 1) {
    errors.push('Flow must contain at least one End node.')
  }

  const nodeIds = new Set(nodes.map((node) => node.id))

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id ?? `${edge.source}->${edge.target}`} has invalid nodes.`)
    }
  }

  for (const node of nodes) {
    if (node.type === 'condition') {
      const outgoing = edges.filter((edge) => edge.source === node.id)
      const handles = new Set(outgoing.map((edge) => edge.sourceHandle).filter(Boolean))
      if (!handles.has('true') || !handles.has('false')) {
        errors.push(`Condition node "${node.data?.label ?? node.id}" needs true and false outputs.`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
