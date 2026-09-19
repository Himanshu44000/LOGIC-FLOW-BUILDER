import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log error to console for now. In future, send to monitoring.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-semibold">Replay failed to render</div>
          <div className="mt-1">{this.state.error?.message || 'Unknown error'}</div>
          <div className="mt-2 text-xs text-red-700">Open the browser console for details.</div>
        </div>
      )
    }

    return this.props.children
  }
}
