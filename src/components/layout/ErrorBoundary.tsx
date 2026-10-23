import { Component, type ReactNode } from 'react'
import { Button } from '../ui/Button'

interface State {
  failed: boolean
}

/** Shows a friendly message instead of a blank page; never exposes stack traces. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alert"
        className="mx-auto mt-24 max-w-md rounded-2xl border border-line bg-panel p-8 text-center"
      >
        <h1 className="mb-2 text-lg font-semibold">Something went wrong</h1>
        <p className="mb-5 text-sm text-muted">
          This view hit an unexpected problem, possibly because of a very large or unusual file.
          Your files were not uploaded anywhere. Please try again.
        </p>
        <Button variant="primary" onClick={() => this.setState({ failed: false })}>
          Try again
        </Button>
      </div>
    )
  }
}
