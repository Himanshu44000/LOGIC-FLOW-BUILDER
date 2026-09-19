import { useMemo, useState } from 'react'
import { Check, Copy, Download, FileCode2, Play } from 'lucide-react'
import { CODE_LANGUAGE_OPTIONS, downloadCode, generateCodeFromFlow } from '../../utils/codeGenerator'
import { runGeneratedJavaScript } from '../../utils/codeRunner'
import { useFlowStore } from '../../store/useFlowStore'

export default function CodeGenerationPanel({ flowName, nodes, edges }) {
  const [language, setLanguage] = useState('javascript')
  const [copied, setCopied] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const setResult = useFlowStore((s) => s.setResult)
  const pushConsoleLog = useFlowStore((s) => s.pushConsoleLog)

  const generated = useMemo(() => generateCodeFromFlow(nodes, edges, language, flowName), [nodes, edges, language, flowName])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generated.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const handleDownload = () => {
    const selected = CODE_LANGUAGE_OPTIONS.find((option) => option.value === language)
    const fileName = `${flowName?.trim()?.replace(/[^A-Za-z0-9_-]/g, '_') || 'generated-flow'}.${selected?.extension ?? 'txt'}`
    downloadCode(fileName, generated.code)
  }

  const handleRunCode = async () => {
    setIsRunning(true)
    const start = Date.now()
    const res = await runGeneratedJavaScript(generated.code, 5000)
    const duration = Date.now() - start

    if (res.error) {
      const errorMsg = res.timedOut ? '⏱️ Execution timed out (5s limit). Check for infinite loops.' : res.error
      setResult({ status: 'failed', executionTime: duration, outputs: {}, path: [], errors: [errorMsg], logs: res.logs, variables: {} })
      res.logs.forEach((l) => pushConsoleLog(l))
      setIsRunning(false)
      return
    }

    setResult({ status: 'success', executionTime: duration, outputs: {}, path: [], errors: [], logs: res.logs, variables: { result: res.result } })
    res.logs.forEach((l) => pushConsoleLog(l))
    setIsRunning(false)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Code Generation</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Generate code from the current flow in multiple languages.</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">Language</label>
          <select
            className="field-input !mt-0 w-44"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {CODE_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={handleCopy} className="toolbar-btn">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy Code'}
        </button>
        {language === 'javascript' && (
          <button
            type="button"
            onClick={() => setShowWarning(true)}
            disabled={isRunning}
            className="toolbar-btn"
          >
            {isRunning ? <>⏳ Running...</> : <><Play size={16} /> Run Code</>}
          </button>
        )}
        <button type="button" onClick={handleDownload} className="toolbar-btn">
          <Download size={16} /> Download
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <FileCode2 size={14} /> {generated.language}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100 dark:border-slate-700">
        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap font-mono leading-6">{generated.code}</pre>
      </div>

      {generated.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-semibold">Generator notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {generated.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {showWarning && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 max-w-sm shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">⚠️ Run Generated Code?</h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">This will execute the generated JavaScript code in your browser. Make sure the code is safe.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowWarning(false)
                  handleRunCode()
                }}
                className="flex-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700 transition"
              >
                Run Code
              </button>
              <button
                type="button"
                onClick={() => setShowWarning(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
