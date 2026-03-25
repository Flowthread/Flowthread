import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let errorMessage = "Something went wrong.";
      try {
        if (error && error.message) {
          const parsed = JSON.parse(error.message);
          if (parsed.error === "Missing or insufficient permissions.") {
            errorMessage = "You don't have permission to view this data. Please make sure you're logged in with the correct account.";
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
          <div className="mb-6 text-5xl">⚠️</div>
          <h2 className="mb-2 text-2xl font-bold text-slate-900">Oops!</h2>
          <p className="mb-8 max-w-xs text-slate-500">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-200"
          >
            Try Again
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
