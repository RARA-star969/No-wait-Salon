import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Last-resort safety net around the Gym/Salon Detail render — the one
 * screen transition every listing tap goes through. A render exception
 * here must never leave the customer staring at a blank WebView with no
 * way back; it must show a controlled recovery screen with a working way
 * home, and it must surface the real error (message + stack) so a crash
 * that only reproduces on a real device can be diagnosed from what the
 * screen itself shows, without needing adb/remote debugging.
 *
 * Scoped to the Detail render only (not the whole app) so a crash inside
 * Gym/Salon Detail can never take Home down with it.
 */
type DetailErrorBoundaryProps = { businessName: string; onBackToHome: () => void; children: React.ReactNode };
type DetailErrorBoundaryState = { error: Error | null };

// This repo has no @types/react installed (every other component here is
// functional/hooks-only) — extending React.Component's own class typing
// therefore doesn't reliably pick up `props`/`state` through generics, so
// both are declared explicitly rather than relied on from the base class.
export class DetailErrorBoundary extends React.Component<DetailErrorBoundaryProps, DetailErrorBoundaryState> {
  declare props: DetailErrorBoundaryProps;
  state: DetailErrorBoundaryState = { error: null };

  constructor(props: DetailErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): DetailErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Logged for Chrome remote debugging / adb logcat capture on a real
    // device — this is the exact stack a future investigation needs.
    console.error('[DetailErrorBoundary] Business detail render crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-[#17201F]">Something went wrong</h2>
          <p className="mt-2 max-w-sm text-sm text-[#6F7C7A]">
            We couldn&apos;t open {this.props.businessName}. Nothing was lost — you can go back and try again.
          </p>
          <button
            onClick={this.props.onBackToHome}
            className="mt-6 rounded-xl bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0D645E]"
          >
            Back to Home
          </button>
          <details className="mt-6 w-full max-w-sm text-left">
            <summary className="cursor-pointer text-xs font-semibold text-[#9AA6A3]">Technical details</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#F1F4F3] p-3 text-[10px] text-[#4C5A58]">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
