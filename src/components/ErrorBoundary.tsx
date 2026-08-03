import React, { ReactNode } from "react";
import { errorReporter } from "../services/errorReporter";

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional custom fallback UI. When provided it replaces the default
   * full-screen error screen — used for scoped (per-view) boundaries so a
   * crash in one feature doesn't blank the whole app. The fallback receives
   * the caught error and a reset callback.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console for debugging
    console.error("Error caught by boundary:", error);
    errorReporter.reportError(error, {
      type: "react",
      context: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error ?? new Error("Unknown error"),
          this.handleReset,
        );
      }
      return (
        <div className="flex items-center justify-center h-screen bg-red-50 dark:bg-red-900/30">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md">
            <div className="mb-4">
              <div className="text-5xl mb-3">⚠️</div>
              <h1 className="text-2xl font-bold text-red-800 dark:text-red-200">
                Something went wrong
              </h1>
            </div>

            <p className="text-slate-600 dark:text-slate-300 mb-4">
              An unexpected error occurred. Please try again.
            </p>

            {this.state.error && (
              <details className="mb-6 p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                <summary className="font-mono text-slate-700 dark:text-slate-200 cursor-pointer">
                  Error details
                </summary>
                <pre className="mt-2 text-xs overflow-auto max-h-40 text-slate-600 dark:text-slate-300">
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
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-50 transition"
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
