import { Router } from 'express'
import { execute, getExecutionHistory } from '../controllers/execution.controller.js'
import { executeStream } from '../controllers/execution-stream.controller.js'
import { controlRun, getRunStatus } from '../controllers/execution-control.controller.js'

const router = Router()

router.post('/run', execute)
router.post('/run-stream', executeStream)
router.post('/:runId/control', controlRun)
router.get('/:runId/status', getRunStatus)
router.get('/history', getExecutionHistory)

export default router
