"use client";

import { useEffect } from "react";

const AUTH_PATHS = ["/api/auth/", "/api/admin/auth/"];

/** Keeps active user/admin sessions alive and retries one request after refresh. */
export function SessionKeeper() {
  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    let userRefresh: Promise<boolean> | null = null;
    let adminRefresh: Promise<boolean> | null = null;

    const refresh = (admin: boolean) => {
      const current = admin ? adminRefresh : userRefresh;
      if (current) return current;
      const task = nativeFetch(admin ? "/api/admin/auth/refresh" : "/api/auth/refresh", {
        method: "POST", cache: "no-store", credentials: "same-origin",
      }).then((response) => response.ok).catch(() => false).finally(() => {
        if (admin) adminRefresh = null; else userRefresh = null;
      });
      if (admin) adminRefresh = task; else userRefresh = task;
      return task;
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const retryInput = input instanceof Request ? input.clone() : input;
      const response = await nativeFetch(input, init);
      if (response.status !== 401) return response;
      const raw = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
      let pathname = raw;
      try { pathname = new URL(raw, window.location.origin).pathname; } catch {}
      if (AUTH_PATHS.some((prefix) => pathname.startsWith(prefix))) return response;
      const admin = pathname.startsWith("/api/admin/") || pathname.startsWith("/api/library");
      if (!(await refresh(admin))) return response;
      return nativeFetch(retryInput, init);
    };

    const keepAlive = () => {
      if (document.visibilityState !== "visible") return;
      const admin = window.location.pathname.startsWith("/admin-panel");
      void refresh(admin);
    };
    const timer = window.setInterval(keepAlive, 8 * 60 * 1000);
    document.addEventListener("visibilitychange", keepAlive);
    window.addEventListener("focus", keepAlive);
    return () => {
      window.fetch = nativeFetch;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", keepAlive);
      window.removeEventListener("focus", keepAlive);
    };
  }, []);
  return null;
}
