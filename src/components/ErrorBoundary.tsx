import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';

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
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetData = () => {
    try {
      localStorage.removeItem('chantsstudioforgrade5_lessons');
      localStorage.removeItem('singbuddy_lessons');
      localStorage.removeItem('chantsstudio_mode');
    } catch {
      // ignore
    }
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-4">
          <div className="bg-white border-4 border-pink-400 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl space-y-5 animate-scale-up">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-pink-100 border-2 border-pink-300 flex items-center justify-center text-4xl shadow-inner animate-bounce">
              🤖
            </div>

            <div>
              <div className="inline-block bg-purple-100 text-purple-700 font-extrabold text-[11px] px-3 py-1 rounded-full border border-purple-200 mb-2">
                ✨ Designed by Tím
              </div>
              <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
                RoboBuddy Needs a Quick Reboot!
              </h1>
              <p className="text-xs sm:text-sm font-bold text-zinc-500 mt-1">
                Don't worry, your music studio is safe! Click the button below to restart your session.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-left text-xs font-mono text-rose-700 break-words max-h-32 overflow-y-auto">
                <div className="flex items-center gap-1.5 font-bold mb-1 text-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Error Details:</span>
                </div>
                <span>{this.state.error.message || String(this.state.error)}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-black text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <RefreshCw className="w-4 h-4 animate-spin-reverse" />
                <span>Reload Studio</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetData}
                className="py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                title="Clear local cache and restore original songs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Lessons</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
