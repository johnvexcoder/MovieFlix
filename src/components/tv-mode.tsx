"use client";

import { useEffect } from "react";
import { useTvMode } from "@/hooks/use-tv-mode";
import { useTvNavigation } from "@/hooks/use-tv-navigation";

/**
 * Mounted once in the root layout. Applies the TV-mode class and activates
 * global D-pad navigation when a Smart TV browser is detected, and marks the
 * app as hydrated so the white-screen sentinel in layout.tsx stays hidden.
 */
export function TvModeBridge() {
  const isTv = useTvMode();
  useTvNavigation(isTv);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => {
      try {
        (window as unknown as { __MOVIEFLIX_READY__?: boolean }).__MOVIEFLIX_READY__ = true;
      } catch {
        /* ignore */
      }
    }, 250);
    return () => window.clearTimeout(readyTimer);
  }, []);

  return null;
}