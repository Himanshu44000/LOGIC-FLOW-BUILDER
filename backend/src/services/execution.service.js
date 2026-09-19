import { prisma } from '../prisma/client.js'
import { executeFlow } from '../engine/executionEngine.js'

export async function runExecution({ flowId, nodes, edges, speedMs }) {
  const result = await executeFlow({ nodes, edges, speedMs })
  const status = result.errors.length > 0 ? 'failed' : 'success'

  const history = await prisma.executionHistory.create({
    data: {
      flowId,
      status,
      input: { nodes, edges, speedMs },
      result,
    },
  })

  return {
    ...result,
    historyId: history.id,
    status,
  }
}

export async function listExecutionHistory(flowId) {
  return prisma.executionHistory.findMany({
    where: flowId ? { flowId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}
