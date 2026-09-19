import { useState, useEffect, useCallback, useRef } from 'react'
import { useFlowStore } from '../../store/useFlowStore'
import { flowApi } from '../../services/api'
import { Play, Pause, RotateCcw, SkipForward, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

export default function ExecutionReplayPanel() {
  const executionRecordings = useFlowStore((s) => s.executionRecordings)
  const currentReplay = useFlowStore((s) => s.currentReplay)
  const setCurrentReplay = useFlowStore((s) => s.setCurrentReplay)
  const deleteExecutionRecording = useFlowStore((s) => s.deleteExecutionRecording)

  const [expandedRecordingId, setExpandedRecordingId] = useState(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const playbackIntervalRef = useRef(null)
  const [viewMode, setViewMode] = useState('map') // 'map' or 'recorded'

  const applyRecordingSnapshot = useFlowStore((s) => s.applyRecordingSnapshot)
  const restoreSnapshotView = useFlowStore((s) => s.restoreSnapshotView)

  // Get current recording and step if replaying
  const currentRecording =
    currentReplay && executionRecordings.find((r) => r.id === currentReplay.recordingId)
  const currentStep = currentRecording?.steps?.[currentReplay?.currentStepIndex]

  // Auto-advance playback
  useEffect(() => {
    try {
      if (!currentReplay?.isPlaying || !currentRecording?.steps) return

      const interval = setInterval(() => {
        try {
          const nextIndex = (currentReplay.currentStepIndex || 0) + 1
          if (nextIndex >= (currentRecording.steps?.length || 0)) {
            // Playback finished
            setCurrentReplay({ ...currentReplay, isPlaying: false })
          } else {
            setCurrentReplay({
              ...currentReplay,
              currentStepIndex: nextIndex,
            })
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Replay interval error', err)
        }
      }, 1000 / Math.max(0.1, playbackSpeed))

      playbackIntervalRef.current = interval
      return () => clearInterval(interval)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Playback effect error', err)
    }
  }, [currentReplay?.isPlaying, currentReplay?.currentStepIndex, currentRecording?.steps, playbackSpeed, currentReplay, setCurrentReplay])

  // When current recording or viewMode changes, apply or restore recorded snapshot view
  useEffect(() => {
    try {
      if (!currentRecording) {
        restoreSnapshotView()
        return
      }
      if (viewMode === 'recorded') {
        if (currentRecording.snapshot) {
          applyRecordingSnapshot(currentRecording)
        }
      } else {
        // map mode: ensure the canvas reflects the user's current flow
        restoreSnapshotView()
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('apply/restore snapshot error', err)
    }
    return () => {
      // when the component unmounts or recording changes, restore
      restoreSnapshotView()
    }
  }, [currentRecording?.id, viewMode, applyRecordingSnapshot, restoreSnapshotView])

  const handleStartReplay = (recordingId) => {
    setCurrentReplay({
      recordingId,
      currentStepIndex: 0,
      isPlaying: false,
      speed: 1,
    })
    setExpandedRecordingId(null)
  }

  const handlePlayPause = () => {
    if (!currentReplay) return
    setCurrentReplay({
      ...currentReplay,
      isPlaying: !currentReplay.isPlaying,
    })
  }

  const handleStep = () => {
    if (!currentReplay || !currentRecording?.steps) return
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

  const handleRewind = () => {
    if (!currentReplay) return
    setCurrentReplay({
      ...currentReplay,
      currentStepIndex: 0,
      isPlaying: false,
    })
  }

  const handleSliderChange = (e) => {
    if (!currentReplay) return
    setCurrentReplay({
      ...currentReplay,
      currentStepIndex: parseInt(e.target.value),
      isPlaying: false,
    })
  }

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  if (!executionRecordings.length) {
    return (
      <div className="space-y-4 rounded-lg border border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          📽️ Execution Replay
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Run your flow to record executions here. You'll be able to replay them step-by-step!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        📽️ Execution Replay
      </h3>

      {/* Playback Controls (visible when replaying) */}
      {currentReplay && currentRecording && (
        <div className="space-y-3 rounded-lg border border-orange-300 bg-orange-50 p-3 dark:border-orange-700 dark:bg-orange-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-900 dark:text-orange-100">
              Replaying: {currentRecording.description}
            </span>
            <span className="text-xs text-orange-700 dark:text-orange-300">
              Step {(currentReplay.currentStepIndex || 0) + 1} / {currentRecording.steps.length}
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-orange-700 dark:text-orange-300">View:</label>
            <button
              onClick={() => setViewMode('map')}
              className={`text-xs rounded px-2 py-1 ${viewMode === 'map' ? 'bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100' : 'bg-white dark:bg-slate-800'}`}
            >
              Map to Current Diagram
            </button>
            <button
              onClick={() => setViewMode('recorded')}
              className={`text-xs rounded px-2 py-1 ${viewMode === 'recorded' ? 'bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100' : 'bg-white dark:bg-slate-800'}`}
            >
              Recorded Snapshot
            </button>
          </div>

          {/* Timeline Slider */}
          <input
            type="range"
            min="0"
            max={currentRecording.steps.length - 1}
            value={currentReplay.currentStepIndex || 0}
            onChange={handleSliderChange}
            className="w-full"
          />

          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRewind}
              className="rounded p-1 hover:bg-orange-200 dark:hover:bg-orange-800"
              title="Rewind to start (Ctrl+Home)"
            >
              <RotateCcw size={16} className="text-orange-700 dark:text-orange-300" />
            </button>
            <button
              onClick={handlePlayPause}
              className="rounded p-1 hover:bg-orange-200 dark:hover:bg-orange-800"
              title={currentReplay.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {currentReplay.isPlaying ? (
                <Pause size={16} className="text-orange-700 dark:text-orange-300" />
              ) : (
                <Play size={16} className="text-orange-700 dark:text-orange-300" />
              )}
            </button>
            <button
              onClick={handleStep}
              className="rounded p-1 hover:bg-orange-200 dark:hover:bg-orange-800"
              title="Step forward (Right Arrow)"
            >
              <SkipForward size={16} className="text-orange-700 dark:text-orange-300" />
            </button>

            {/* Speed Control */}
            <div className="ml-auto flex items-center gap-1">
              <label className="text-xs text-orange-700 dark:text-orange-300">Speed:</label>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="rounded border border-orange-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-orange-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>
          </div>

          {/* Current Step Info */}
          {currentStep && (
            <div className="space-y-2 rounded bg-white p-2 dark:bg-slate-800">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Node: {currentStep.nodeLabel} ({currentStep.nodeType})
              </div>
              <div className="max-h-32 overflow-y-auto">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <strong>Variables at this step:</strong>
                  <pre className="mt-1 bg-slate-100 p-1 text-xs dark:bg-slate-900">
                    {JSON.stringify(currentStep.variables, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recording List */}
      <div className="space-y-2">
        {executionRecordings.map((recording) => (
          <div key={recording.id} className="rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800">
            <button
              onClick={() =>
                setExpandedRecordingId(expandedRecordingId === recording.id ? null : recording.id)
              }
              className="flex w-full items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {expandedRecordingId === recording.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <div className="flex-1 text-left">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {recording.description}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {recording.steps.length} steps • {formatTime(recording.duration)} • {new Date(recording.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </button>

            {expandedRecordingId === recording.id && (
              <div className="border-t border-slate-300 p-2 dark:border-slate-600">
                <div className="mb-2 max-h-40 space-y-1 overflow-y-auto">
                  {recording.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className={`text-xs p-1 rounded cursor-pointer ${
                        currentReplay?.recordingId === recording.id &&
                        currentReplay?.currentStepIndex === idx
                          ? 'bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                      onClick={() => {
                        setCurrentReplay({
                          recordingId: recording.id,
                          currentStepIndex: idx,
                          isPlaying: false,
                          speed: 1,
                        })
                      }}
                    >
                      <strong>{step.nodeLabel}</strong> - {step.status}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleStartReplay(recording.id)}
                    className="flex-1 rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                  >
                    ▶ Replay
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('Delete this recording?')) {
                        if (useFlowStore.getState().flowId) {
                          try {
                            await flowApi.recordings.remove(useFlowStore.getState().flowId, recording.id)
                          } catch (e) {
                            // ignore server failure and still remove locally
                          }
                        }
                        deleteExecutionRecording(recording.id)
                      }
                    }}
                    className="rounded px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900"
                    title="Delete recording"
                  >
                    <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
