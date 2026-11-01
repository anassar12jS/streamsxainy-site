import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('StreamHub Uncaught UI Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in text-[var(--text-main)]">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-5 text-amber-400 shadow-xl">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-main)] mb-2">Something went sideways</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md mb-6 leading-relaxed">
            The page encountered an unexpected issue while rendering media details. Don't worry, your progress and library are intact.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-xs font-bold text-[var(--text-main)] transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry</span>
            </button>
            <button
              onClick={this.handleReset}
              className="px-6 py-2.5 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
