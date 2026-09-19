import React from 'react'

export default function VariableWatchPanel({ variables }) {
  const entries = variables && typeof variables === 'object' ? Object.entries(variables) : []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Live Variables</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No variables yet. Run the flow and pause to inspect values.</p>
      ) : (
        <div className="mt-3 text-xs">
          <ul className="space-y-2">
            {entries.map(([k, v]) => (
              <li key={k} className="flex items-start justify-between rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                <div className="font-semibold text-slate-700 dark:text-slate-200">{k}</div>
                <pre className="ml-3 max-w-xs overflow-auto text-slate-600 dark:text-slate-300">{JSON.stringify(v)}</pre>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
