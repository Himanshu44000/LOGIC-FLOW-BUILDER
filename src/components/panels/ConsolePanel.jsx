export default function ConsolePanel({ logs, variables }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mini Console</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest runtime logs and variables.</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <pre className="max-h-36 overflow-auto rounded-lg bg-slate-100 p-2 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{JSON.stringify(logs ?? [], null, 2)}</pre>
        <pre className="max-h-36 overflow-auto rounded-lg bg-slate-100 p-2 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{JSON.stringify(variables ?? {}, null, 2)}</pre>
      </div>
    </section>
  )
}
