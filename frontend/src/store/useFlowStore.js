import { applyEdgeChanges, applyNodeChanges, addEdge } from 'reactflow'
import { create } from 'zustand'
import { createNode } from '../constants/nodeTemplates'

const INITIAL_FLOW_NAME = 'Untitled Flow'

function snapshot(nodes, edges) {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
  }
}

function storageKeyForFlow(flowId) {
  return `lfb:watches:${flowId ?? 'unsaved'}`
}

function storageKeyForRecordings(flowId) {
  return `lfb:recordings:${flowId ?? 'unsaved'}`
}

function saveWatchesForFlow(flowId, watches) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    localStorage.setItem(storageKeyForFlow(flowId), JSON.stringify(watches ?? []))
  } catch (e) {
    // non-fatal
    // eslint-disable-next-line no-console
    console.warn('saveWatchesForFlow failed', e)
  }
}

function loadWatchesForFlow(flowId) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return []
    const raw = localStorage.getItem(storageKeyForFlow(flowId))
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('loadWatchesForFlow failed', e)
    return []
  }
}

function saveRecordingsForFlow(flowId, recordings) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    // Keep only last 10 recordings to avoid storage bloat
    const recent = recordings.slice(-10)
    localStorage.setItem(storageKeyForRecordings(flowId), JSON.stringify(recent))
  } catch (e) {
    // non-fatal
    // eslint-disable-next-line no-console
    console.warn('saveRecordingsForFlow failed', e)
  }
}

function loadRecordingsForFlow(flowId) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return []
    const raw = localStorage.getItem(storageKeyForRecordings(flowId))
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('loadRecordingsForFlow failed', e)
    return []
  }
}

function normalizeNodeData(node) {
  if (!node || node.type !== 'for-loop') return node
  const data = node.data ?? {}
  return {
    ...node,
    data: {
      ...data,
      counter: data.counter ?? 'i',
      start: data.start ?? '0',
      left: data.left ?? data.counter ?? 'i',
      operator: data.operator ?? data.endOperator ?? '<=',
      right: data.right ?? data.end ?? '5',
      step: data.step ?? '1',
    },
  }
}

function normalizeNodes(nodes) {
  return Array.isArray(nodes) ? nodes.map(normalizeNodeData) : []
}

export const useFlowStore = create((set, get) => ({
  flowId: null,
  flowName: INITIAL_FLOW_NAME,
  nodes: [createNode('start', { x: 120, y: 200 }), createNode('end', { x: 760, y: 200 })],
  edges: [],
  selectedNodeId: null,
  executionSpeedMs: 250,
  result: null,
  consoleLogs: [],
  watchExpressions: [],
  previousWatchValues: {}, // {watchId: formattedValue}
  past: [],
  future: [],
  executionRecordings: [], // Array of { id, timestamp, duration, recording: steps[] }
  currentReplay: null, // { recordingId, currentStepIndex, isPlaying, speed }
  // When applying a recorded snapshot to the canvas for exact replay,
  // we keep a backup so we can restore the user's current flow afterwards.
  __replaySnapshotBackup: null,
  isViewingRecordedSnapshot: false,

  setExecutionSpeedMs: (value) => set({ executionSpeedMs: value }),
  setFlowName: (flowName) => set({ flowName }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setResult: (result) => set({ result }),
  pushConsoleLog: (log) => set((state) => ({ consoleLogs: [log, ...state.consoleLogs].slice(0, 200) })),
  clearConsoleLogs: () => set({ consoleLogs: [] }),
  addWatchExpression: (expression) => {
    const value = typeof expression === 'string' ? expression.trim() : ''
    if (!value) return

    const id = globalThis.crypto?.randomUUID?.() || `watch-${Date.now()}-${Math.random().toString(16).slice(2)}`
    set((state) => {
      const next = [...state.watchExpressions, { id, expression: value }]
      saveWatchesForFlow(state.flowId, next)
      return { watchExpressions: next }
    })
  },
  updateWatchExpression: (id, expression) => {
    const value = typeof expression === 'string' ? expression.trim() : ''
    if (!id || !value) return

    set((state) => {
      const next = state.watchExpressions.map((watch) => (watch.id === id ? { ...watch, expression: value } : watch))
      saveWatchesForFlow(state.flowId, next)
      return { watchExpressions: next }
    })
  },
  removeWatchExpression: (id) => {
    if (!id) return

    set((state) => {
      const next = state.watchExpressions.filter((watch) => watch.id !== id)
      saveWatchesForFlow(state.flowId, next)
      return { watchExpressions: next }
    })
  },
  setWatchExpressions: (watchExpressions) =>
    set((state) => {
      const next = Array.isArray(watchExpressions) ? watchExpressions : []
      saveWatchesForFlow(state.flowId, next)
      return { watchExpressions: next }
    }),

  updatePreviousWatchValues: (previousValues) => {
    set({ previousWatchValues: previousValues || {} })
  },

  addExecutionRecording: (recording) => {
    set((state) => {
      const id = globalThis.crypto?.randomUUID?.() || `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const newRecording = {
        id,
        flowId: state.flowId,
        timestamp: Date.now(),
        duration: recording.duration || 0,
        steps: recording.steps || [],
        snapshot: recording.snapshot || null, // { nodes, edges }
        description: recording.description || `Execution ${new Date().toLocaleTimeString()}`,
      }
      const next = [...state.executionRecordings, newRecording]
      saveRecordingsForFlow(state.flowId, next)
      return { executionRecordings: next }
    })
  },

  getExecutionRecordings: () => get().executionRecordings,

  deleteExecutionRecording: (recordingId) => {
    set((state) => {
      const next = state.executionRecordings.filter((r) => r.id !== recordingId)
      saveRecordingsForFlow(state.flowId, next)
      // if deleting current replay, clear it
      const currentReplay = state.currentReplay?.recordingId === recordingId ? null : state.currentReplay
      return { executionRecordings: next, currentReplay }
    })
  },

  clearExecutionRecordings: () => {
    set((state) => {
      saveRecordingsForFlow(state.flowId, [])
      return { executionRecordings: [], currentReplay: null }
    })
  },

  setExecutionRecordings: (recordings) => set({ executionRecordings: Array.isArray(recordings) ? recordings : [] }),

  setCurrentReplay: (replayState) => {
    // replayState: { recordingId, currentStepIndex, isPlaying, speed }
    set({ currentReplay: replayState })
  },

  applyRecordingSnapshot: (recording) => {
    // Apply a flow snapshot (nodes/edges) from a recording to the canvas temporarily.
    // Save current nodes/edges to backup so we can restore later.
    try {
      const { nodes, edges } = get()
      if (!recording?.snapshot) return
      const snapshot = recording.snapshot
      set({ __replaySnapshotBackup: { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }, nodes: snapshot.nodes ? JSON.parse(JSON.stringify(snapshot.nodes)) : [], edges: snapshot.edges ? JSON.parse(JSON.stringify(snapshot.edges)) : [], isViewingRecordedSnapshot: true })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('applyRecordingSnapshot failed', e)
    }
  },

  restoreSnapshotView: () => {
    try {
      const backup = get().__replaySnapshotBackup
      if (!backup) return
      set({ nodes: backup.nodes || [], edges: backup.edges || [], __replaySnapshotBackup: null, isViewingRecordedSnapshot: false })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('restoreSnapshotView failed', e)
    }
  },
  
  commitHistory: () => {
    const { nodes, edges, past } = get()
    set({
      past: [...past, snapshot(nodes, edges)].slice(-100),
      future: [],
    })
  },

  setFlow: ({ id = null, name, nodes, edges }) =>
    set(() => {
      const loaded = loadWatchesForFlow(id)
      const loadedRecordings = loadRecordingsForFlow(id)
      return {
        flowId: id,
        flowName: name,
        nodes: normalizeNodes(nodes ? JSON.parse(JSON.stringify(nodes)) : []),
        edges: edges ? JSON.parse(JSON.stringify(edges)) : [],
        selectedNodeId: null,
        result: null,
        watchExpressions: Array.isArray(loaded) ? loaded : [],
        executionRecordings: Array.isArray(loadedRecordings) ? loadedRecordings : [],
        currentReplay: null,
        past: [],
        future: [],
        consoleLogs: [],
      }
    }),

  resetFlow: () =>
    set({
      flowId: null,
      flowName: INITIAL_FLOW_NAME,
      nodes: [createNode('start', { x: 120, y: 200 }), createNode('end', { x: 760, y: 200 })],
      edges: [],
      breakpoints: [],
      selectedNodeId: null,
      result: null,
      watchExpressions: [],
      previousWatchValues: {},
      executionRecordings: [],
      currentReplay: null,
      past: [],
      future: [],
      consoleLogs: [],
    }),

  addNodeByType: (type, position) => {
    get().commitHistory()
    set((state) => ({
      nodes: [...state.nodes, createNode(type, position)],
    }))
  },

  updateNodeData: (nodeId, patch) => {
    get().commitHistory()
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...patch,
              },
            }
          : node,
      ),
    }))
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }))
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }))
  },

  onConnect: (connection) => {
    get().commitHistory()
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          animated: true,
        },
        state.edges,
      ),
    }))
  },

  removeSelectedNode: () => {
    const nodeId = get().selectedNodeId
    if (!nodeId) return

    get().commitHistory()
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      selectedNodeId: null,
    }))
  },

  undo: () => {
    const { past, future, nodes, edges } = get()
    if (!past.length) return

    const previous = past[past.length - 1]
    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: past.slice(0, -1),
      future: [snapshot(nodes, edges), ...future],
    })
  },

  redo: () => {
    const { past, future, nodes, edges } = get()
    if (!future.length) return

    const next = future[0]
    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, snapshot(nodes, edges)],
      future: future.slice(1),
    })
  },

  setNodesAndEdges: (nodes, edges) => set({ nodes, edges }),
  breakpoints: [],
  toggleBreakpoint: (nodeId) =>
    set((state) => {
      const breakpoints = state.breakpoints.includes(nodeId)
        ? state.breakpoints.filter((b) => b !== nodeId)
        : [...state.breakpoints, nodeId]

      return { breakpoints }
    }),
  setBreakpoints: (bps) => set({ breakpoints: Array.isArray(bps) ? bps : [] }),
}))
