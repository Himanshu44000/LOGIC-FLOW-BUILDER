import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { ZodError } from 'zod'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev', {
  skip: (req, res) => {
    const status = res.statusCode
    const url = req.originalUrl || req.url || ''

    // Drop conditional-cache noise and high-frequency read polling.
    if (status === 304) return true
    if (req.method === 'GET' && (url.startsWith('/api/flows') || url.startsWith('/api/executions/history'))) {
      return true
    }

    return false
  },
}))

app.use('/api', routes)
app.use(notFoundHandler)
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Invalid request payload',
      details: err.issues,
    })
  }

  next(err)
})
app.use(errorHandler)

export default app
