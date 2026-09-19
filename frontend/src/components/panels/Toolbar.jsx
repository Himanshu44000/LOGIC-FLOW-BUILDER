import { Play, Save, Trash2, Undo2, Redo2, Download, Upload, Sun, Moon, Bell } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function Toolbar({
  onRun,
  onSave,
  onClear,
  onUndo,
  onRedo,
  onExport,
  onImport,
  speed,
  onSpeedChange,
  isExecuting,
  onPause,
  onContinue,
  onStep,
  onStop,
  analysisIssueCount = 0,
  onOpenAnalysis,
}) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onSave} className="toolbar-btn"><Save size={16} /> Save</button>
        <button 
          onClick={onRun} 
          disabled={isExecuting}
          className={`toolbar-btn bg-emerald-600 text-white hover:bg-emerald-700 ${isExecuting ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="F5"
        >
          <Play size={16} /> {isExecuting ? 'Running...' : 'Run'}
        </button>
        <button onClick={onPause} disabled={!isExecuting} className="toolbar-btn">Pause</button>
        <button onClick={onStep} disabled={!isExecuting} className="toolbar-btn" title="F10">Step</button>
        <button onClick={onContinue} disabled={!isExecuting} className="toolbar-btn" title="F8">Continue</button>
        <button onClick={onStop} disabled={!isExecuting} className="toolbar-btn">Stop</button>
        {/* Debug Run removed per UX decision */}
        <button onClick={onUndo} className="toolbar-btn"><Undo2 size={16} /> Undo</button>
        <button onClick={onRedo} className="toolbar-btn"><Redo2 size={16} /> Redo</button>
        <button onClick={onClear} className="toolbar-btn"><Trash2 size={16} /> Clear</button>
        <button onClick={onExport} className="toolbar-btn"><Download size={16} /> Export</button>
        <button onClick={onOpenAnalysis} className="toolbar-btn relative">
          <Bell size={16} /> Static Analysis
          {analysisIssueCount > 0 && (
            <span className="ml-1 inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold leading-none text-white">
              {analysisIssueCount}
            </span>
          )}
        </button>
        <label className="toolbar-btn cursor-pointer">
          <Upload size={16} /> Import
          <input className="hidden" type="file" accept="application/json" onChange={onImport} />
        </label>

        <div className="ml-auto flex items-center gap-3">
          <label className="text-xs text-slate-600 dark:text-slate-300">Speed: {speed}ms</label>
          <input
            type="range"
            min="0"
            max="2000"
            step="50"
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
          />
          <button onClick={toggleTheme} className="toolbar-btn min-w-32 justify-center">
            {isDark ? <Sun size={16} /> : <Moon size={16} />} {isDark ? 'Dark Theme' : 'Light Theme'}
          </button>
        </div>
      </div>
    </div>
  )
}
