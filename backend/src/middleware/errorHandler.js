export function notFoundHandler(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` })
}

export function errorHandler(err, req, res, next) {
  const status = err.status ?? 500
  const message = err.message ?? 'Internal server error'

  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  }

  res.status(status).json({
    message,
    details: err.details ?? null,
  })
}
