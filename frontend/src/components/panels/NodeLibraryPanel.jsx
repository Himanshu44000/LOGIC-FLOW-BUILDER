import { NODE_CATALOG } from '../../constants/nodeTemplates'

export default function NodeLibraryPanel() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Node Library</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Drag blocks onto the canvas.</p>

      <div className="mt-4 space-y-2">
        {NODE_CATALOG.map((node) => (
          <button
            key={node.type}
            type="button"
            draggable
            onDragStart={(event) => onDragStart(event, node.type)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <span>{node.title}</span>
            <span className="h-2 w-2 rounded-full" style={{ background: node.color }}></span>
          </button>
        ))}
      </div>
    </aside>
  )
}
