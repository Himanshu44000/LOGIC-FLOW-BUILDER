export default function ExecutionPanel({ result }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Execution Result</h3>
      {!result ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Run the flow to see path, outputs, and runtime diagnostics.</p>
      ) : (
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Status: {result.status}</p>
            <p className="text-slate-500 dark:text-slate-400">Execution Time: {result.executionTime} ms</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Outputs</p>
            <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{JSON.stringify(result.outputs, null, 2)}</pre>
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Path</p>
            <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{JSON.stringify(result.path, null, 2)}</pre>
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Errors</p>
            <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{JSON.stringify(result.errors, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  )
}
