"use client";

import { Component, type ReactNode } from "react";

interface AppErrorBoundaryState {
  error: Error | null;
}

/**
 * Professional-grade diagnostics for runtime failures. Replaces the traditional
 * white/blank screen with an actionable panel that explains what went wrong and
 * offers a reload. In TV mode the panel is larger and clearer for a 10-foot
 * experience, and the raw message is only revealed after expanding a details
 * disclosure (safe for on-screen display on a TV).
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string | null }) {
    console.error("[MovieFlix] UI crashed:", error, errorInfo?.componentStack);
  }

  private handleReload = () => {
    // Hard reload bypasses caches that may be serving corrupted assets.
    this.setState({ error: null });
    window.location.reload();
  };

  private handleClearCache = () => {
    try {
      const cachesApi = window.caches;
      if (cachesApi) {
        cachesApi.keys().then((keys) => {
          return Promise.all(keys.map((key) => cachesApi.delete(key)));
        });
      }
    } catch {
      /* ignore */
    }
    this.handleReload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        data-tv-error-screen
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#020611",
          color: "#fff",
        }}
      >
        <div style={{ maxWidth: "640px", width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", marginBottom: "0.5rem" }}>
            Something went wrong
          </div>
          <p style={{ fontSize: "1rem", color: "#9ca3af", margin: "0 0 1.5rem" }}>
            MovieFlix hit an unexpected error while loading this screen. Your
            watch history and profile data are safe.
          </p>

          <details style={{ textAlign: "left", margin: "0 0 1.5rem" }}>
            <summary style={{ cursor: "pointer", color: "#00d2f5", fontSize: "0.9rem" }}>
              Technical details
            </summary>
            <pre
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem 1rem",
                background: "#0b1629",
                border: "1px solid #243955",
                borderRadius: 12,
                fontSize: "0.75rem",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </pre>
          </details>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                minHeight: 44,
                padding: "0.75rem 1.5rem",
                borderRadius: 999,
                border: "1px solid #00d2f5",
                background: "#00d2f5",
                color: "#03111e",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleClearCache}
              style={{
                minHeight: 44,
                padding: "0.75rem 1.5rem",
                borderRadius: 999,
                border: "1px solid #58728f",
                background: "#101b31",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Reload after clearing cache
            </button>
          </div>
        </div>
      </div>
    );
  }
}