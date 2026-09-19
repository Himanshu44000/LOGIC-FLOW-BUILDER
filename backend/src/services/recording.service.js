import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'recordings')
const MAX_PER_FLOW = 50

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
  } catch (e) {
    // ignore
  }
}

function fileForFlow(flowId) {
  return path.join(DATA_DIR, `${flowId}.json`)
}

export async function listRecordings(flowId) {
  try {
    await ensureDataDir()
    const file = fileForFlow(flowId)
    const raw = await fs.readFile(file, 'utf-8').catch(() => '[]')
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

export async function addRecording(flowId, recording) {
  try {
    await ensureDataDir()
    const file = fileForFlow(flowId)
    const current = await listRecordings(flowId)
    const next = [...current, { ...recording, id: recording.id || `${Date.now()}-${Math.random().toString(16).slice(2)}` }].slice(-MAX_PER_FLOW)
    await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf-8')
    return next[next.length - 1]
  } catch (e) {
    throw e
  }
}

export async function deleteRecording(flowId, recordingId) {
  try {
    const file = fileForFlow(flowId)
    const current = await listRecordings(flowId)
    const next = current.filter((r) => r.id !== recordingId)
    await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf-8')
    return true
  } catch (e) {
    return false
  }
}
