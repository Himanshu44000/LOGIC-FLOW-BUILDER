import { useMemo } from 'react'

const FIELD_MAP = {
  input: ['variableName', 'value'],
  condition: ['left', 'operator', 'right'],
  'while-loop': ['condition', 'counter'],
  output: ['value'],
  delay: ['milliseconds'],
  math: ['target', 'left', 'operator', 'right'],
  api: ['method', 'url', 'body', 'saveTo'],
}

const SELECT_OPTIONS = {
  operator: ['>', '<', '>=', '<=', '==', '!=', '+', '-', '*', '/', '%'],
  method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}

export default function NodeEditorPanel({ selectedNode, onChange }) {
  const forLoopMode = useMemo(() => {
    if (selectedNode?.type !== 'for-loop') return null
    if (selectedNode?.data?.forLoopMode) return selectedNode.data.forLoopMode
    return selectedNode?.data?.left || selectedNode?.data?.operator || selectedNode?.data?.right ? 'coder' : 'simple'
  }, [selectedNode?.data?.forLoopMode, selectedNode?.data?.left, selectedNode?.data?.operator, selectedNode?.data?.right, selectedNode?.type])

  const fields = useMemo(() => {
    if (selectedNode?.type !== 'for-loop') return FIELD_MAP[selectedNode?.type] ?? []
    return forLoopMode === 'simple' ? ['counter', 'start', 'end', 'step'] : ['counter', 'start', 'left', 'operator', 'right', 'step']
  }, [forLoopMode, selectedNode?.type])

  const setForLoopMode = (mode) => {
    if (!selectedNode || selectedNode.type !== 'for-loop') return
    if (mode === 'coder') {
      onChange(selectedNode.id, {
        forLoopMode: 'coder',
        left: selectedNode.data?.left ?? selectedNode.data?.counter ?? 'i',
        operator: selectedNode.data?.operator ?? '<=',
        right: selectedNode.data?.right ?? selectedNode.data?.end ?? '5',
      })
      return
    }

    onChange(selectedNode.id, {
      forLoopMode: 'simple',
      end: selectedNode.data?.end ?? selectedNode.data?.right ?? '5',
    })
  }

  return (
    <aside className="h-full overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Node Editor</h3>
      {!selectedNode ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Select a node to edit its properties.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-slate-600 dark:text-slate-300">Label</label>
          <input
            className="field-input"
            value={selectedNode.data?.label ?? ''}
            onChange={(event) => onChange(selectedNode.id, { label: event.target.value })}
          />

          {selectedNode.type === 'for-loop' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/60">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">For Loop Mode</div>
              <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200 sm:flex-row">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <input type="radio" name={`for-loop-mode-${selectedNode.id}`} checked={forLoopMode !== 'simple'} onChange={() => setForLoopMode('coder')} />
                  <span>Coder</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <input type="radio" name={`for-loop-mode-${selectedNode.id}`} checked={forLoopMode === 'simple'} onChange={() => setForLoopMode('simple')} />
                  <span>Non-coder</span>
                </label>
              </div>
            </div>
          )}

          {fields.map((field) => (
            <div key={field}>
              <label className="block text-xs text-slate-600 capitalize dark:text-slate-300">
                {field === 'left' ? 'Condition Left' : field === 'right' ? 'Condition Right' : field}
              </label>
              {SELECT_OPTIONS[field] ? (
                <select
                  className="field-input"
                  value={selectedNode.data?.[field] ?? SELECT_OPTIONS[field][0]}
                  onChange={(event) => onChange(selectedNode.id, { [field]: event.target.value })}
                >
                  {SELECT_OPTIONS[field].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="field-input"
                  value={selectedNode.data?.[field] ?? ''}
                  onChange={(event) => onChange(selectedNode.id, { [field]: event.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
