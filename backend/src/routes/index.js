import { Router } from 'express'
import flowRoutes from './flow.routes.js'
import executionRoutes from './execution.routes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

router.use('/flows', flowRoutes)
router.use('/executions', executionRoutes)

export default router
