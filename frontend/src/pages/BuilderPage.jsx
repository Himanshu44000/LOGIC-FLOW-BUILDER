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
import VariableWatchPanel from '../components/panels/VariableWatchPanel'
import WatchExpressionPanel from '../components/panels/WatchExpressionPanel'
import ExecutionReplayPanel from '../components/panels/ExecutionReplayPanel'
import ErrorBoundary from '../components/ErrorBoundary'
import CodeGenerationPanel from '../components/panels/CodeGenerationPanel'
import Toolbar from '../components/panels/Toolbar'
import analyzeFlow from '../utils/staticAnalyzer'
import { useAutosave } from '../hooks/useAutosave'
import { useExecutionStream } from '../hooks/useExecutionStream'

function BuilderCanvas() {
  const navigate = useNavigate()
  const { flowId } = useParams()

  const [history, setHistory] = useState([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [executedNodes, setExecutedNodes] = useState(new Set())
  const [executedPath, setExecutedPath] = useState([])
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false)
  const { runWithStream, pauseRun, continueRun, stepRun, stopRun, setBreakpoints } = useExecutionStream()
  const [liveVariables, setLiveVariables] = useState({})

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
  const setStoreBreakpoints = useFlowStore((s) => s.setBreakpoints)

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId])
  const flowSnapshot = useMemo(() => JSON.stringify(buildFlowPayload(flowName, nodes, edges)), [flowName, nodes, edges])
  const analysisIssues = useMemo(() => analyzeFlow(nodes, edges), [nodes, edges])
  const analysisIssueCount = useMemo(
    () => analysisIssues.filter((issue) => issue.severity === 'error').length,
    [analysisIssues],
  )
  const lastSavedSnapshotRef = useRef('')
  const currentRunIdRef = useRef(null)
  const [pausedAt, setPausedAt] = useState(null)
  const reactFlowInstance = useRef(null)

  const handleNodeEvent = (event) => {
    // notify when paused so user knows where to act
    if (event.status === 'paused') {
      const node = nodes.find((n) => n.id === event.nodeId)
      const label = node?.data?.label || node?.data?.name || node?.label || event.nodeId
      setPausedAt({ nodeId: event.nodeId, nodeLabel: label, runId: event.runId })
      toast('Execution paused at: ' + label)
      // center the paused node in the canvas if possible
      try {
        if (reactFlowInstance.current && event.nodeId) {
          reactFlowInstance.current.fitView({ nodes: [event.nodeId], padding: 0.15, includeHiddenNodes: true })
        }
      } catch (e) {
        // ignore
      }
    }
    // Handle node event statuses
    if (event.status === 'completed') {
      setExecutedNodes((prev) => new Set([...prev, event.nodeId]))
    }

    // update live variables snapshot if present
    if (event.variables) setLiveVariables(event.variables)

    // Track execution path (ordered)
    if (event.nodeId) {
      setExecutedPath((prev) => {
        if (prev.length === 0 || prev[prev.length - 1] !== event.nodeId) return [...prev, event.nodeId]
        return prev
      })
    }

    // Visual updates: paused/executing/completed
    const highlightedNodes = nodes.map((node) => {
      const isCurrent = node.id === event.nodeId
      return {
        ...node,
        data: {
          ...node.data,
          isActive: event.status === 'executing' && isCurrent,
          isPaused: event.status === 'paused' && isCurrent,
          isInPath: (node.data?.isInPath) || (event.status === 'completed' && node.id === event.nodeId),
        },
        style: {
          ...node.style,
          opacity: executedNodes.has(node.id) || isCurrent ? 1 : 0.4,
          backgroundColor: event.status === 'paused' && isCurrent ? '#f97316' : node.style?.backgroundColor,
        },
      }
    })
    setNodesAndEdges(highlightedNodes, edges)
  }

  const handleComplete = async (result) => {
    setResult(result)
    setIsExecuting(false)
    setPausedAt(null)
    setExecutedPath([])

    // Capture execution recording if available
    if (result?.recording && Array.isArray(result.recording) && result.recording.length > 0) {
      const addExecutionRecording = useFlowStore.getState().addExecutionRecording
      // include a deep-copied snapshot of the flow so replay can show exact historical graph
      const payload = {
        steps: result.recording,
        duration: result.executionTime || 0,
        description: `Execution ${new Date().toLocaleTimeString()}`,
        snapshot: { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) },
      }

      // If the flow is saved on the server, try to persist recordings server-side first.
      if (currentFlowId) {
        try {
          const created = await flowApi.recordings.create(currentFlowId, payload)
          addExecutionRecording(created)
        } catch (err) {
          // fallback to local-only storage
          addExecutionRecording(payload)
        }
      } else {
        addExecutionRecording(payload)
      }
    }

    toast.success(result.errors.length ? 'Execution finished with warnings' : 'Execution successful')
    currentRunIdRef.current = null
  }

  const handleError = (error) => {
    setIsExecuting(false)
    setPausedAt(null)
    toast.error(error || 'Execution failed')
    currentRunIdRef.current = null
  }

  // Handle replay visualization: highlight current step node and update variables
  const executionRecordings = useFlowStore((s) => s.executionRecordings)

  useEffect(() => {
    try {
      if (!currentReplay || !executionRecordings.length) return

      const recording = executionRecordings.find((r) => r.id === currentReplay.recordingId)
      if (!recording?.steps) return

      const currentStep = recording.steps[currentReplay.currentStepIndex]
      if (!currentStep) return

      // Update live variables to show current step state
      setLiveVariables(currentStep.variables || {})

      // Highlight current node
      const replayNode = {
        nodeId: currentStep.nodeId,
        nodeType: currentStep.nodeType,
        nodeLabel: currentStep.nodeLabel,
        status: 'replaying',
        timestamp: Date.now(),
      }

      const highlightedNodes = nodes.map((node) => {
        const isCurrent = node.id === replayNode.nodeId
        return {
          ...node,
          style: {
            ...node.style,
            opacity: isCurrent ? 1 : 0.4,
            backgroundColor: isCurrent ? '#8b5cf6' : node.style?.backgroundColor,
            borderWidth: isCurrent ? 3 : node.style?.borderWidth,
          },
        }
      })

      // Only update store if something actually changed to avoid infinite update loops
      const needUpdate = highlightedNodes.some((hn) => {
        const cur = nodes.find((n) => n.id === hn.id)
        if (!cur) return true
        const curStyle = cur.style || {}
        const newStyle = hn.style || {}
        if (curStyle.opacity !== newStyle.opacity) return true
        if ((curStyle.backgroundColor || '') !== (newStyle.backgroundColor || '')) return true
        if ((curStyle.borderWidth || 0) !== (newStyle.borderWidth || 0)) return true
        // check data flags that may be used for visuals
        if (JSON.stringify(cur.data?.isActive) !== JSON.stringify(hn.data?.isActive)) return true
        if (JSON.stringify(cur.data?.isPaused) !== JSON.stringify(hn.data?.isPaused)) return true
        return false
      })

      if (needUpdate) setNodesAndEdges(highlightedNodes, edges)

      // Auto-focus current node
      try {
        if (reactFlowInstance.current && replayNode.nodeId) {
          reactFlowInstance.current.fitView({
            nodes: [replayNode.nodeId],
            padding: 0.15,
            includeHiddenNodes: true,
          })
        }
      } catch (e) {
        // ignore
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Replay visualization error', err)
    }
  }, [currentReplay?.currentStepIndex, currentReplay?.recordingId, executionRecordings, nodes, edges, setNodesAndEdges])

  useEffect(() => {
    const init = async () => {
      if (flowId === 'new') {
        resetFlow()
        return
      }

      try {
        const flow = await flowApi.get(flowId)
        setFlow({ id: flow.id, name: flow.name, nodes: flow.nodes, edges: flow.edges })
        try {
          const serverRecs = await flowApi.recordings.list(flow.id)
          useFlowStore.getState().setExecutionRecordings(Array.isArray(serverRecs) ? serverRecs : [])
        } catch (e) {
          // ignore server failures
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

    executionApi
      .history(currentFlowId)
      .then(setHistory)
      .catch(() => setHistory([]))
  }, [currentFlowId, result])

  useEffect(() => {
    if (!currentFlowId) return
    lastSavedSnapshotRef.current = flowSnapshot
  }, [currentFlowId])

  useAutosave(async () => {
    if (!currentFlowId) return
    // Prevent persisting temporary replay visual states to the real flow.
    if (isViewingRecordedSnapshot || currentReplay) return
    if (flowSnapshot === lastSavedSnapshotRef.current) return

    try {
      const breakpoints = useFlowStore.getState().breakpoints || []
      const nodesWithBps = nodes.map((n) => ({ ...n, data: { ...n.data, breakpoint: breakpoints.includes(n.id) } }))
      const payload = buildFlowPayload(flowName, nodesWithBps, edges)
      await flowApi.update(currentFlowId, payload)
      lastSavedSnapshotRef.current = JSON.stringify(payload)
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
      // include per-node breakpoint flags in node data for persistence
      const breakpoints = useFlowStore.getState().breakpoints || []
      const nodesWithBps = nodes.map((n) => ({ ...n, data: { ...n.data, breakpoint: breakpoints.includes(n.id) } }))
      const payload = buildFlowPayload(flowName, nodesWithBps, edges)

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
      // stop any existing run first to avoid multiple concurrent runs
      if (currentRunIdRef.current) {
        try { await stopRun(currentRunIdRef.current) } catch (e) { /* ignore */ }
        currentRunIdRef.current = null
      }
      setIsExecuting(true)
      setExecutedNodes(new Set())
      setExecutedPath([])
      const payload = {
        flowId: currentFlowId,
        nodes,
        edges,
        speedMs: executionSpeedMs,
        breakpoints: useFlowStore.getState().breakpoints || [],
      }

      const runId = await runWithStream(payload, handleNodeEvent, handleComplete, handleError)
      currentRunIdRef.current = runId
    } catch (error) {
      setIsExecuting(false)
      toast.error(error.response?.data?.message ?? 'Execution failed')
    }
  }

  

  const handlePause = async () => {
    if (!currentRunIdRef.current) return
    await pauseRun(currentRunIdRef.current)
  }

  const handleContinue = async () => {
    if (!currentRunIdRef.current) return
    await continueRun(currentRunIdRef.current)
  }

  const handleStep = async () => {
    if (!currentRunIdRef.current) return
    await stepRun(currentRunIdRef.current)
  }

  const handleStop = async () => {
    if (!currentRunIdRef.current) return
    try {
      await stopRun(currentRunIdRef.current)
    } catch (e) {
      // ignore
    }
    setIsExecuting(false)
    setPausedAt(null)
    currentRunIdRef.current = null
  }

  // Center a node in the canvas and select it
  const focusNode = (nodeId) => {
    if (!nodeId) return
    setSelectedNodeId(nodeId)
    try {
      if (reactFlowInstance.current) reactFlowInstance.current.fitView({ nodes: [nodeId], padding: 0.15, includeHiddenNodes: true })
    } catch (e) {
      // ignore
    }
  }

  // Keyboard shortcuts: F5 Run/Stop, F8 Continue, F10 Step, F9 Toggle breakpoint on selected node
  // During replay: Space for play/pause, Right arrow for step, Home for rewind
  useEffect(() => {
    const currentReplay = useFlowStore.getState().currentReplay
    const setCurrentReplay = useFlowStore.getState().setCurrentReplay
    const executionRecordings = useFlowStore.getState().executionRecordings

    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return

      // Replay shortcuts (if replaying)
      if (currentReplay) {
        if (e.code === 'Space') {
          e.preventDefault()
          setCurrentReplay({ ...currentReplay, isPlaying: !currentReplay.isPlaying })
          return
        }

        if (e.key === 'ArrowRight') {
          e.preventDefault()
          const currentRecording = executionRecordings.find((r) => r.id === currentReplay.recordingId)
          if (currentRecording?.steps) {
            const nextIndex = Math.min(
              (currentReplay.currentStepIndex || 0) + 1,
              currentRecording.steps.length - 1
            )
            setCurrentReplay({
              ...currentReplay,
              currentStepIndex: nextIndex,
              isPlaying: false,
            })
          }
          return
        }

        if (e.key === 'Home') {
          e.preventDefault()
          setCurrentReplay({
            ...currentReplay,
            currentStepIndex: 0,
            isPlaying: false,
          })
          return
        }

        if (e.key === 'Escape') {
          e.preventDefault()
          useFlowStore.getState().setCurrentReplay(null)
          return
        }
      }

      // Regular execution shortcuts
      if (e.key === 'F5') {
        e.preventDefault()
        if (isExecuting) handleStop()
        else handleRun()
      }

      if (e.key === 'F8') {
        e.preventDefault()
        handleContinue()
      }

      if (e.key === 'F10') {
        e.preventDefault()
        handleStep()
      }

      if (e.key === 'F9') {
        e.preventDefault()
        if (selectedNodeId) {
          // toggle breakpoint via store
          useFlowStore.getState().toggleBreakpoint(selectedNodeId)
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isExecuting, selectedNodeId])

  // Debug Run removed; use Run with breakpoints the user sets manually.

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
          onPause={handlePause}
          onContinue={handleContinue}
          onStep={handleStep}
          onStop={handleStop}
        />
        {/* Execution breadcrumb: show ordered nodes executed so far */}
        {executedPath.length > 0 && (
          <div className="my-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <div className="text-xs text-slate-500">Path:</div>
            <div className="flex items-center gap-2 overflow-auto">
              {executedPath.map((id, idx) => {
                const node = nodes.find((n) => n.id === id)
                const label = node?.data?.label || node?.data?.name || node?.label || id
                return (
                  <button key={id} onClick={() => focusNode(id)} className="rounded-md px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">
                    {label}{idx < executedPath.length - 1 ? ' →' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}

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
                key={currentFlowId || 'builder-canvas'}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={(inst) => (reactFlowInstance.current = inst)}
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
	    <VariableWatchPanel variables={liveVariables || result?.variables} />
          <WatchExpressionPanel variables={liveVariables || result?.variables} />
	    <ErrorBoundary>
	      <ExecutionReplayPanel />
	    </ErrorBoundary>
          <CodeGenerationPanel flowName={flowName} nodes={nodes} edges={edges} />
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
