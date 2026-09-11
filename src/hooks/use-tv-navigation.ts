"use client";

import { useEffect, useRef } from "react";

/**
 * D-pad / directional navigation for TV remotes.
 *
 * Activation is opt-in (`enabled`). When active it listens on `window` and
 * performs spatial navigation over every visible focusable element (page and
 * portal content alike), which keeps desktop/mobile completely unaffected.
 *
 *  - Arrow keys move focus geometrically (nearest element in that direction).
 *  - Enter / Space activate the focused control (its real onClick fires).
 *  - Escape bubbles a `tv:back` CustomEvent so modals/screens can hook it via
 *    `useTvBack`, defaulting to no action.
 *  - Text inputs are left alone: while one is focused, arrow keys keep normal
 *    caret behaviour instead of moving focus.
 *
 * Focused elements render a supersized glow ring from tv-compat.css.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const DISABLE_NAV_ROLES = new Set(["textbox", "combobox", "spinbutton"]);

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  const style = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
  if (!style) return rect.width > 0 && rect.height > 0;
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
}

function rectCenter(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function collectFocusables(root: Document): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return all.filter((el) => isVisible(el));
}

function findSpatialTarget(
  items: HTMLElement[],
  current: HTMLElement | null,
  dir: "up" | "down" | "left" | "right"
): HTMLElement | null {
  const origin = current ? rectCenter(current) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of items) {
    const c = rectCenter(el);
    const deltaX = c.x - origin.x;
    const deltaY = c.y - origin.y;

    if (dir === "left" && deltaX >= -1) continue;
    if (dir === "right" && deltaX <= 1) continue;
    if (dir === "up" && deltaY >= -1) continue;
    if (dir === "down" && deltaY <= 1) continue;

    const axis = dir === "left" || dir === "right" ? Math.abs(deltaY) : Math.abs(deltaX);
    const perp = dir === "left" || dir === "right" ? Math.abs(deltaX) : Math.abs(deltaY);
    // Favour items on the same row/column, then close distance.
    const score = Math.abs(deltaX) + Math.abs(deltaY) + axis * 1.6 + perp * 0.2;

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export function useTvNavigation(enabled: boolean): void {
  const lastFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement as HTMLElement | null;

      // Never steal caret/keyboard behaviour from text entry.
      const activeTag = active ? active.tagName.toLowerCase() : "";
      if (
        active &&
        (activeTag === "input" ||
          activeTag === "textarea" ||
          activeTag === "select" ||
          DISABLE_NAV_ROLES.has(active.getAttribute("role") || "") ||
          (active as HTMLElement & { isContentEditable?: boolean }).isContentEditable)
      ) {
        return;
      }

      const dirMap: Record<string, "up" | "down" | "left" | "right"> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };

      if (dirMap[e.key]) {
        e.preventDefault();

        const items = collectFocusables(document);
        if (items.length === 0) return;

        let current: HTMLElement | null = active;
        if (!current || !isVisible(current)) current = lastFocusRef.current;
        if (!current || !isVisible(current)) current = null;

        const target = findSpatialTarget(items, current, dirMap[e.key]);
        if (target) {
          lastFocusRef.current = target;
          target.focus({ preventScroll: true });
        }
        return;
      }

      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        if (active && enabled) {
          e.preventDefault();
          active.click();
        }
        return;
      }

      if (e.key === "Escape" || e.key === "Backspace") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("tv:back"));
        }
      }
    }

    // Re-focus the last D-pad target when focus is lost (e.g. a dialog closes
    // and React leaves focus on <body>).
    function onFocusOut(e: FocusEvent) {
      const next = e.relatedTarget as HTMLElement | null;
      if (!next || next === document.body) {
        if (lastFocusRef.current && isVisible(lastFocusRef.current)) {
          setTimeout(() => {
            if ((document.activeElement as HTMLElement | null) === document.body) {
              lastFocusRef.current?.focus({ preventScroll: true });
            }
          }, 0);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, [enabled]);
}

/** Register a handler for the D-pad "back" event (Escape from a TV remote). */
export function useTvBack(handler: () => void): void {
  const handlerRef = useRef<() => void>(() => {});

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    function onBack() {
      handlerRef.current();
    }
    window.addEventListener("tv:back", onBack);
    return () => window.removeEventListener("tv:back", onBack);
  }, []);
}