"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Isolate a single slide/element render failure so a bad AI widget cannot
 * take down the editor, dashboard preview, or present mode.
 */
export class RenderErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[render]", this.props.label ?? "element", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full flex items-center justify-center px-3 text-center text-[12px] text-text-tertiary">
          Couldn&apos;t render this {this.props.label ?? "element"}
        </div>
      );
    }
    return this.props.children;
  }
}
