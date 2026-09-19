import { Handle, Position } from 'reactflow'
import { getNodeMeta } from '../../constants/nodeTemplates'
import { useFlowStore } from '../../store/useFlowStore'

function conditionHandles() {
  const handleStyle = { width: '16px', height: '16px', border: '2px solid white', boxShadow: '0 0 4px rgba(0,0,0,0.3)' }
  return (
    <>
      <Handle id="true" type="source" position={Position.Right} style={{ top: '35%', background: '#22c55e', ...handleStyle }} />
      <Handle id="false" type="source" position={Position.Right} style={{ top: '70%', background: '#ef4444', ...handleStyle }} />
    </>
  )
}

function loopHandles() {
  const handleStyle = { width: '16px', height: '16px', border: '2px solid white', boxShadow: '0 0 4px rgba(0,0,0,0.3)' }
  return (
    <>
      <Handle id="loop" type="source" position={Position.Right} style={{ top: '35%', background: '#0ea5e9', ...handleStyle }} />
      <Handle id="exit" type="source" position={Position.Right} style={{ top: '70%', background: '#f59e0b', ...handleStyle }} />
    </>
  )
}

export default function FlowNode({ id, type, data }) {
  const meta = getNodeMeta(type)
  const handleStyle = { width: '16px', height: '16px', border: '2px solid white', boxShadow: '0 0 4px rgba(0,0,0,0.3)' }
  const isLoopNode = type === 'for-loop' || type === 'while-loop'
  const toggleBreakpoint = useFlowStore((s) => s.toggleBreakpoint)
  const breakpoints = useFlowStore((s) => s.breakpoints)
  const hasBreakpoint = breakpoints.includes(id)

  return (
    <div
      className={`relative min-w-44 rounded-xl border px-3 py-2 text-left shadow transition-all ${
        data?.isActive
          ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300 dark:border-amber-300 dark:bg-amber-950/50'
          : data?.isInPath
            ? 'border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
      }`}
      style={{ borderTop: `4px solid ${meta.color}` }}
    >
      {/* breakpoint toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          toggleBreakpoint(id)
        }}
        title={hasBreakpoint ? 'Remove breakpoint' : 'Add breakpoint'}
        className="absolute -mt-8 ml-2 h-3 w-3 rounded-full"
        style={{ background: hasBreakpoint ? '#ef4444' : '#94a3b8', border: '2px solid white' }}
      />
      <Handle type="target" position={Position.Left} style={{ background: '#64748b', ...handleStyle }} />
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{meta.title}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{data?.label ?? type}</div>
      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        {type === 'for-loop'
          ? `${data?.counter ?? 'i'}: ${data?.start} to ${data?.end}`
          : type === 'while-loop'
            ? data?.condition
            : data?.variableName ?? data?.expression ?? data?.value ?? ''}
      </div>

      {type === 'condition' ? conditionHandles() : isLoopNode ? loopHandles() : <Handle type="source" position={Position.Right} style={{ background: meta.color, ...handleStyle }} />}
      {type === 'condition' && (
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span>TRUE</span>
          <span>FALSE</span>
        </div>
      )}
      {isLoopNode && (
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span>LOOP</span>
          <span>EXIT</span>
        </div>
      )}

      <div className="hidden">{id}</div>
    </div>
  )
}
