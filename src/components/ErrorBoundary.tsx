import React, { ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ERROR BOUNDARY: Catches unhandled React errors and displays user-friendly fallback UI.
 * Prevents entire app from crashing on component errors.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    // Log to console for debugging
    console.error("Error caught by boundary:", error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
            <div className="mb-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h1 className="text-2xl font-bold text-red-900">Something went wrong</h1>
            </div>

            <p className="text-slate-600 mb-4">An unexpected error occurred. Please try again.</p>

            {this.state.error && (
              <details className="mb-6 p-3 bg-slate-100 rounded text-sm">
                <summary className="font-mono text-slate-700 cursor-pointer">Error details</summary>
                <pre className="mt-2 text-xs overflow-auto max-h-40 text-slate-600">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
