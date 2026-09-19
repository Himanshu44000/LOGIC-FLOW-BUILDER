import { Router } from 'express'
import {
  cloneFlow,
  createNewFlow,
  getFlow,
  getFlows,
  removeFlow,
  updateExistingFlow,
} from '../controllers/flow.controller.js'
import { listRecordings, createRecording, removeRecording } from '../controllers/recording.controller.js'

const router = Router()

router.get('/', getFlows)
router.get('/:id', getFlow)
router.post('/', createNewFlow)
router.put('/:id', updateExistingFlow)
router.delete('/:id', removeFlow)
router.post('/:id/duplicate', cloneFlow)

// Recording persistence for a flow
router.get('/:id/recordings', listRecordings)
router.post('/:id/recordings', createRecording)
router.delete('/:id/recordings/:recordingId', removeRecording)

export default router
