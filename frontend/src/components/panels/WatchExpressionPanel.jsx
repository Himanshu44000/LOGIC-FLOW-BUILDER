import { useCallback, useMemo, useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useFlowStore } from '../../store/useFlowStore'

function resolvePath(source, expression) {
  if (!expression || source == null) return undefined

  const tokens = []
  const pattern = /([^.[\]]+)|\[(?:([^"'\]]+)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\]/g
  expression.replace(pattern, (_, numericKey, doubleQuoted, singleQuoted) => {
    const token = numericKey ?? doubleQuoted ?? singleQuoted
    if (token !== undefined) tokens.push(token)
    return ''
  })

  let current = source
  for (const token of tokens) {
    if (current == null) return undefined
    current = current[token]
  }

  return current
}

function formatValue(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function resolveWatchExpressions(watches, variables) {
  return (Array.isArray(watches) ? watches : []).map((watch) => {
    const currentValue = resolvePath(variables, watch.expression)
    return {
      ...watch,
      currentValue,
      formattedValue: formatValue(currentValue),
    }
  })
}

export default function WatchExpressionPanel({ variables }) {
  const [draft, setDraft] = useState('')
  const [highlightedWatches, setHighlightedWatches] = useState(new Set())
  const watches = useFlowStore((state) => state.watchExpressions)
  const previousWatchValues = useFlowStore((state) => state.previousWatchValues)
  const addWatchExpression = useFlowStore((state) => state.addWatchExpression)
  const removeWatchExpression = useFlowStore((state) => state.removeWatchExpression)
  const updatePreviousWatchValues = useFlowStore((state) => state.updatePreviousWatchValues)

  const resolvedWatches = useMemo(() => resolveWatchExpressions(watches, variables), [watches, variables])

  // Detect changes and highlight
  useEffect(() => {
    const changed = new Set()
    for (const watch of resolvedWatches) {
      const prevValue = previousWatchValues[watch.id]
      if (prevValue !== undefined && prevValue !== watch.formattedValue) {
        changed.add(watch.id)
      }
    }

    if (changed.size > 0) {
      setHighlightedWatches(changed)
      // Auto-clear highlight after 2 seconds
      const timer = setTimeout(() => setHighlightedWatches(new Set()), 2000)
      return () => clearTimeout(timer)
    }
  }, [resolvedWatches, previousWatchValues])

  // Update previous values when watches resolve
  useEffect(() => {
    const prevMap = {}
    for (const watch of resolvedWatches) {
      prevMap[watch.id] = watch.formattedValue
    }
    updatePreviousWatchValues(prevMap)
  }, [resolvedWatches, updatePreviousWatchValues])

  const handleAdd = () => {
    addWatchExpression(draft)
    setDraft('')
  }

  const nodes = useFlowStore((s) => s.nodes)

  const handleSuggestWatches = useCallback(() => {
    if (!Array.isArray(nodes)) return

    const candidates = new Set()

    const moustachePattern = /{{\s*([^}]+)\s*}}/g

    for (const node of nodes) {
      if (!node || typeof node !== 'object' || !node.data) continue
      const d = node.data
      if (d.variableName) candidates.add(d.variableName)
      if (d.target) candidates.add(d.target)
      if (d.saveTo) candidates.add(d.saveTo)
      if (d.counter) candidates.add(d.counter)

      for (const key of Object.keys(d)) {
        const v = d[key]
        if (typeof v === 'string') {
          let m
          while ((m = moustachePattern.exec(v)) !== null) {
            const path = m[1].trim()
            if (path) candidates.add(path)
          }
        }
      }
    }

    // add up to 10 candidates as watch expressions
    let count = 0
    for (const c of candidates) {
      if (count >= 10) break
      addWatchExpression(c)
      count += 1
    }
  }, [nodes, addWatchExpression])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Watch Expressions</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">Path lookups only</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleAdd()
          }}
          placeholder="e.g. user.name or items[0].price"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <div className="flex items-center gap-2">
          <button onClick={handleAdd} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700">
            <Plus size={14} /> Add
          </button>
          <button
            onClick={handleSuggestWatches}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
            title="Add watch expressions suggested from the current flow"
          >
            Suggest Watches
          </button>
        </div>
      </div>

      {resolvedWatches.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Add a field path to track its value during execution.</p>
      ) : (
        <div className="mt-3 space-y-2 text-xs">
          {resolvedWatches.map((watch) => {
            const isChanged = highlightedWatches.has(watch.id)
            return (
              <div
                key={watch.id}
                className={`rounded-lg border p-3 transition-all duration-300 ${
                  isChanged
                    ? 'border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-200 dark:border-emerald-600 dark:bg-emerald-950/40 dark:shadow-emerald-900/50'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{watch.expression}</div>
                    <div className="mt-1 flex items-center gap-2 wrap-break-word text-slate-600 dark:text-slate-400">
                      <span>{watch.formattedValue}</span>
                      {isChanged && <span className="inline-block rounded bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">changed</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => removeWatchExpression(watch.id)}
                    className="inline-flex items-center rounded-md px-2 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label={`Remove watch ${watch.expression}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
