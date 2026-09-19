import { prisma } from '../prisma/client.js'

export async function listFlows() {
  return prisma.flow.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function getFlowById(id) {
  return prisma.flow.findUnique({ where: { id } })
}

export async function createFlow(payload) {
  return prisma.flow.create({ data: payload })
}

export async function updateFlow(id, payload) {
  return prisma.flow.update({
    where: { id },
    data: payload,
  })
}

export async function deleteFlow(id) {
  return prisma.flow.delete({ where: { id } })
}

export async function duplicateFlow(id) {
  const source = await prisma.flow.findUnique({ where: { id } })
  if (!source) return null

  return prisma.flow.create({
    data: {
      name: `${source.name} (Copy)`,
      nodes: source.nodes,
      edges: source.edges,
    },
  })
}
