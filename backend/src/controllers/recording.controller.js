import * as recordingService from '../services/recording.service.js'

export async function listRecordings(req, res) {
  const flowId = req.params.id
  const recs = await recordingService.listRecordings(flowId)
  res.json(recs)
}

export async function createRecording(req, res) {
  const flowId = req.params.id
  const payload = req.body
  try {
    const created = await recordingService.addRecording(flowId, payload)
    res.status(201).json(created)
  } catch (e) {
    res.status(500).json({ message: 'Failed to save recording' })
  }
}

export async function removeRecording(req, res) {
  const flowId = req.params.id
  const recordingId = req.params.recordingId
  const ok = await recordingService.deleteRecording(flowId, recordingId)
  if (ok) return res.status(204).end()
  return res.status(500).json({ message: 'Failed to delete recording' })
}
