import { useEffect, useState } from 'react'
import { useFlowStore } from '../../store/useFlowStore'
import analyzeFlow from '../../utils/staticAnalyzer'

export default function StaticAnalysisPanel() {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const [issues, setIssues] = useState([])

  const runAnalysis = () => {
    try {
      const res = analyzeFlow(nodes, edges)
      setIssues(res)
    } catch (e) {
      setIssues([{ id: 'error', type: 'internal', severity: 'error', message: 'Analysis failed' }])
    }
  }

  useEffect(() => {
    runAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Static Analysis / Linting</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your app automatically detects mistakes such as unused variables, disconnected nodes, and infinite loop risks.</p>
        </div>
        <div>
          <button onClick={runAnalysis} className="rounded-md bg-cyan-500 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-600">Run</button>
        </div>
      </div>

      <div className="mt-3 max-h-40 overflow-auto text-xs">
        {issues.length === 0 ? (
          <p className="text-slate-400">No issues found.</p>
        ) : (
          issues.map((iss) => (
            <div key={iss.id} className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{iss.message}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Type: {iss.type} • Severity: {iss.severity}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
