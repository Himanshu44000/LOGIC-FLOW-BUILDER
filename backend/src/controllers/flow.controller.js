import {
  createFlow,
  deleteFlow,
  duplicateFlow,
  getFlowById,
  listFlows,
  updateFlow,
} from '../services/flow.service.js'
import { flowPayloadSchema, validateFlowGraph } from '../validators/flow.validator.js'

export async function getFlows(req, res, next) {
  try {
    const flows = await listFlows()
    res.json(flows)
  } catch (error) {
    next(error)
  }
}

export async function getFlow(req, res, next) {
  try {
    const flow = await getFlowById(req.params.id)
    if (!flow) {
      return res.status(404).json({ message: 'Flow not found' })
    }
    res.json(flow)
  } catch (error) {
    next(error)
  }
}

export async function createNewFlow(req, res, next) {
  try {
    const payload = flowPayloadSchema.parse(req.body)
    const validation = validateFlowGraph(payload.nodes, payload.edges)

    if (!validation.isValid) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.errors })
    }

    const flow = await createFlow(payload)
    res.status(201).json(flow)
  } catch (error) {
    next(error)
  }
}

export async function updateExistingFlow(req, res, next) {
  try {
    const payload = flowPayloadSchema.parse(req.body)
    const validation = validateFlowGraph(payload.nodes, payload.edges)

    if (!validation.isValid) {
      return res.status(400).json({ message: 'Validation failed', errors: validation.errors })
    }

    const flow = await updateFlow(req.params.id, payload)
    res.json(flow)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Flow not found' })
    }
    next(error)
  }
}

export async function removeFlow(req, res, next) {
  try {
    await deleteFlow(req.params.id)
    res.status(204).send()
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Flow not found' })
    }
    next(error)
  }
}

export async function cloneFlow(req, res, next) {
  try {
    const flow = await duplicateFlow(req.params.id)
    if (!flow) {
      return res.status(404).json({ message: 'Flow not found' })
    }

    res.status(201).json(flow)
  } catch (error) {
    next(error)
  }
}
