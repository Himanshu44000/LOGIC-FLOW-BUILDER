import { runExecution, listExecutionHistory } from '../services/execution.service.js'
import { executePayloadSchema, validateFlowGraph } from '../validators/flow.validator.js'

export async function execute(req, res, next) {
  try {
    const payload = executePayloadSchema.parse(req.body)
    const validation = validateFlowGraph(payload.nodes, payload.edges)

    if (!validation.isValid) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.errors })
    }

    const result = await runExecution(payload)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export async function getExecutionHistory(req, res, next) {
  try {
    const history = await listExecutionHistory(req.query.flowId)
    res.json(history)
  } catch (error) {
    next(error)
  }
}
