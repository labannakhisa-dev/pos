import { Component, type ReactNode } from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('App crashed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink-950 p-4">
          <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <h2 className="font-display text-lg font-bold text-ink-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-ink-500">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-4"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
