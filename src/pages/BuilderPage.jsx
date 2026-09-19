import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider } from 'reactflow'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { executionApi, flowApi } from '../services/api'
import { useFlowStore } from '../store/useFlowStore'
import { buildFlowPayload, downloadJson, parseImportedFlow, applyPathHighlight } from '../utils/flowHelpers'
import { nodeTypes } from '../components/nodes/nodeTypes'
import NodeLibraryPanel from '../components/panels/NodeLibraryPanel'
import NodeEditorPanel from '../components/panels/NodeEditorPanel'
import ExecutionPanel from '../components/panels/ExecutionPanel'
import ConsolePanel from '../components/panels/ConsolePanel'
import CodeGenerationPanel from '../components/panels/CodeGenerationPanel'
import ExecutionReplayPanel from '../components/panels/ExecutionReplayPanel'
import Toolbar from '../components/panels/Toolbar'
import analyzeFlow from '../utils/staticAnalyzer'
import { useAutosave } from '../hooks/useAutosave'
import { useExecutionStream } from '../hooks/useExecutionStream'

function BuilderCanvas() {
  const navigate = useNavigate()
  const { flowId } = useParams()

  const [isExecuting, setIsExecuting] = useState(false)
  const [executedNodes, setExecutedNodes] = useState(new Set())
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false)
  const { runWithStream } = useExecutionStream()

  const {
    flowId: currentFlowId,
    flowName,
    nodes,
    edges,
    selectedNodeId,
    executionSpeedMs,
    result,
    setResult,
    setExecutionSpeedMs,
    setFlowName,
    setFlow,
    resetFlow,
    addNodeByType,
    updateNodeData,
    setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    undo,
    redo,
    removeSelectedNode,
    setNodesAndEdges,
    isViewingRecordedSnapshot,
    currentReplay,
    setCurrentReplay,
    restoreSnapshotView,
  } = useFlowStore()

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId])
  const flowSnapshot = useMemo(() => JSON.stringify(buildFlowPayload(flowName, nodes, edges)), [flowName, nodes, edges])
  const analysisIssues = useMemo(() => analyzeFlow(nodes, edges), [nodes, edges])
  const analysisIssueCount = useMemo(
    () => analysisIssues.filter((issue) => issue.severity === 'error').length,
    [analysisIssues],
  )
  const lastSavedSnapshotRef = useRef('')

  useEffect(() => {
    const init = async () => {
      if (flowId === 'new') {
        resetFlow()
        return
      }

      try {
        const flow = await flowApi.get(flowId)
        setFlow({ id: flow.id, name: flow.name, nodes: flow.nodes, edges: flow.edges })
        // Try to load server-side recordings for this flow and populate the store
        try {
          const serverRecs = await flowApi.recordings.list(flow.id)
          useFlowStore.getState().setExecutionRecordings(Array.isArray(serverRecs) ? serverRecs : [])
        } catch (e) {
          // ignore server recording load failures
        }
      } catch (error) {
        toast.error(error.response?.data?.message ?? 'Flow not found')
        navigate('/')
      }
    }

    init()
  }, [flowId, navigate, resetFlow, setFlow])

  useEffect(() => {
    if (!currentFlowId) return
    // Reset autosave baseline when switching/initializing flow.
    lastSavedSnapshotRef.current = flowSnapshot
  }, [currentFlowId])

  useAutosave(async () => {
    if (!currentFlowId) return
    // Prevent persisting temporary replay visual states to the real flow.
    if (isViewingRecordedSnapshot || currentReplay) return
    if (flowSnapshot === lastSavedSnapshotRef.current) return

    try {
      await flowApi.update(currentFlowId, buildFlowPayload(flowName, nodes, edges))
      lastSavedSnapshotRef.current = flowSnapshot
    } catch {
      // Skip toast in autosave failure to avoid noisy UX.
    }
  }, 12000)

  useEffect(() => {
    const onKeyDown = (event) => {
      const isCmd = event.ctrlKey || event.metaKey

      if (event.key === 'Delete') {
        removeSelectedNode()
      }

      if (isCmd && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleSave()
      }

      if (isCmd && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      }

      if (isCmd && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const handleSave = async () => {
    if (isViewingRecordedSnapshot || currentReplay) {
      toast.error('Finish replay mode before saving this flow.')
      return
    }
    try {
      const payload = buildFlowPayload(flowName, nodes, edges)

      if (currentFlowId) {
        await flowApi.update(currentFlowId, payload)
        lastSavedSnapshotRef.current = JSON.stringify(payload)
        toast.success('Flow saved')
      } else {
        const created = await flowApi.create(payload)
        toast.success('Flow created')
        navigate(`/builder/${created.id}`)
      }
    } catch (error) {
      const details = error.response?.data?.errors
      if (details?.length) {
        toast.error(details[0])
        return
      }
      toast.error(error.response?.data?.message ?? 'Save failed')
    }
  }

  const handleRun = async () => {
    try {
      setIsExecuting(true)
      setExecutedNodes(new Set())

      const payload = {
        flowId: currentFlowId,
        nodes,
        edges,
        speedMs: executionSpeedMs,
      }

      let executionPath = []
      const nodeExecMap = new Map()

      const handleNodeEvent = (event) => {
        // Track which nodes have executed
        if (event.status === 'completed') {
          setExecutedNodes((prev) => new Set([...prev, event.nodeId]))
          // Update canvas to highlight the executed node
          const highlightedNodes = nodes.map((node) => ({
            ...node,
            style: {
              ...node.style,
              opacity: executedNodes.has(node.id) || node.id === event.nodeId ? 1 : 0.4,
              backgroundColor: node.id === event.nodeId ? '#06b6d4' : node.style?.backgroundColor,
            },
          }))
          setNodesAndEdges(highlightedNodes, edges)
        }
      }

      const handleComplete = async (result) => {
        setResult(result)
        setIsExecuting(false)

        // Save recording into store/localStorage when available (include flow snapshot)
        if (result?.recording && Array.isArray(result.recording) && result.recording.length > 0) {
          const addExecutionRecording = useFlowStore.getState().addExecutionRecording
          const payload = {
            steps: result.recording,
            duration: result.executionTime || 0,
            description: `Execution ${new Date().toLocaleTimeString()}`,
            snapshot: { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) },
          }
          if (currentFlowId) {
            try {
              const created = await flowApi.recordings.create(currentFlowId, payload)
              addExecutionRecording(created)
            } catch (err) {
              addExecutionRecording(payload)
            }
          } else {
            addExecutionRecording(payload)
          }
        }

        toast.success(result.errors.length ? 'Execution finished with warnings' : 'Execution successful')
      }

      const handleError = (error) => {
        setIsExecuting(false)
        toast.error(error || 'Execution failed')
      }

      runWithStream(payload, handleNodeEvent, handleComplete, handleError)
    } catch (error) {
      setIsExecuting(false)
      toast.error(error.response?.data?.message ?? 'Execution failed')
    }
  }

  const onDrop = (event) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/reactflow')

    if (!type) return

    const reactFlowBounds = event.currentTarget.getBoundingClientRect()
    const position = {
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    }

    addNodeByType(type, position)
  }

  const onDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const imported = await parseImportedFlow(file)
      setFlowName(imported.name)
      setNodesAndEdges(imported.nodes, imported.edges)
      toast.success('Flow imported')
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_100%)] dark:text-slate-100">
      <div className="mx-auto w-full" style={{ maxWidth: '1700px' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
            <span aria-hidden="true">←</span> Back to Dashboard
          </Link>
          <input
            className="w-80 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            value={flowName}
            onChange={(event) => setFlowName(event.target.value)}
            placeholder="Flow name"
          />
        </div>

        <Toolbar
          onRun={handleRun}
          onSave={handleSave}
          onClear={resetFlow}
          onUndo={undo}
          onRedo={redo}
          onExport={() => downloadJson(`${flowName}.json`, buildFlowPayload(flowName, nodes, edges))}
          onImport={handleImport}
          speed={executionSpeedMs}
          onSpeedChange={setExecutionSpeedMs}
          isExecuting={isExecuting}
          analysisIssueCount={analysisIssueCount}
          onOpenAnalysis={() => setIsAnalysisOpen(true)}
        />

        <div className="mt-3 grid gap-3 xl:grid-cols-[260px_1fr_330px]">
          <NodeLibraryPanel />

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="relative h-[72vh] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            {(isViewingRecordedSnapshot || currentReplay) && (
              <div className="absolute right-3 top-3 z-20">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      restoreSnapshotView()
                    } catch (e) {
                      // ignore
                    }
                    try {
                      setCurrentReplay(null)
                    } catch (e) {
                      // ignore
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 dark:border-red-700 dark:bg-red-900 dark:text-red-200"
                  title="Exit Replay"
                >
                  Exit Replay
                </button>
              </div>
            )}
            <div className="h-full" onDrop={onDrop} onDragOver={onDragOver}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(event, node) => setSelectedNodeId(node.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                nodeTypes={nodeTypes}
                fitView
              >
                <MiniMap />
                <Controls />
                <Background />
              </ReactFlow>
            </div>
          </motion.div>

          <NodeEditorPanel selectedNode={selectedNode} onChange={updateNodeData} />
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <ExecutionPanel result={result} />
          <ConsolePanel logs={result?.logs} variables={result?.variables} />
          <div className="space-y-3">
            <CodeGenerationPanel flowName={flowName} nodes={nodes} edges={edges} />
            <ExecutionReplayPanel />
          </div>
        </div>

        <AnimatePresence>
          {isAnalysisOpen && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAnalysisOpen(false)}
            >
              <motion.div
                className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                initial={{ y: 24, scale: 0.98, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 24, scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Static Analysis / Linting</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {analysisIssues.length === 0
                        ? 'No issues found in the current flow.'
                        : `${analysisIssues.length} issue${analysisIssues.length === 1 ? '' : 's'} found. Errors are counted on the toolbar badge.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAnalysisOpen(false)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 max-h-[55vh] space-y-2 overflow-auto pr-1 text-sm">
                  {analysisIssues.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200">
                      No issues found.
                    </div>
                  ) : (
                    analysisIssues.map((issue) => (
                      <div key={issue.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{issue.message}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Type: {issue.type} • Severity: {issue.severity}{issue.nodeId ? ` • Node: ${issue.nodeId}` : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function BuilderPage() {
  return (
    <ReactFlowProvider>
      <BuilderCanvas />
    </ReactFlowProvider>
  )
}
