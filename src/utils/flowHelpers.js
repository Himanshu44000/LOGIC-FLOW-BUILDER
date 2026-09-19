export function buildFlowPayload(name, nodes, edges) {
  return {
    name: name?.trim() || 'Untitled Flow',
    nodes,
    edges,
  }
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function parseImportedFlow(file) {
  const text = await file.text()
  const json = JSON.parse(text)

  if (!Array.isArray(json.nodes) || !Array.isArray(json.edges)) {
    throw new Error('Invalid flow file. Expected "nodes" and "edges" arrays.')
  }

  return {
    name: json.name ?? 'Imported Flow',
    nodes: json.nodes,
    edges: json.edges,
  }
}

export function applyPathHighlight(nodes, path, activeIndex = -1) {
  return nodes.map((node, index) => {
    const pathIndex = path.indexOf(node.id)
    const isInPath = pathIndex !== -1
    const isActive = activeIndex !== -1 && path[activeIndex] === node.id

    return {
      ...node,
      data: {
        ...node.data,
        isInPath,
        isActive,
      },
      zIndex: isActive ? 1000 : 1,
    }
  })
}
