"use client";

import { useEffect, useState } from "react";
import { resolveTvMode } from "@/lib/tv-detect";

/**
 * Detects whether the current browser is a Smart TV and exposes the result to
 * components. Also flips `html.tv-mode` on/off so `tv:` Tailwind utilities and
 * the rules in tv-compat.css only apply to the 10-foot experience.
 *
 * Desktop and mobile browsers return `false` and never enable the class.
 */
export function useTvMode(): boolean {
  const [isTv, setIsTv] = useState<boolean>(false);

  useEffect(() => {
    const tv = resolveTvMode();
    document.documentElement.classList.toggle("tv-mode", tv);
    // Deferred so consumers that branch on the boolean never re-render mid-effect.
    const id = window.setTimeout(() => setIsTv(tv), 0);
    return () => window.clearTimeout(id);
  }, []);

  return isTv;
}