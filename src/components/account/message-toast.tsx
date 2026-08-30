"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, X } from "lucide-react";

export interface AdminMessage {
  id: string;
  message: string;
  createdAt: string;
  broadcast: boolean;
}

interface MessageToastProps {
  variant?: "sliding" | "fullscreen";
}

const SEEN_KEY_PREFIX = "movieflix:seen-messages:";

function getSeenKey(accountId?: string) {
  return `${SEEN_KEY_PREFIX}${accountId || "anon"}`;
}

function loadSeen(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Polls /api/messages and shows new admin messages as a compact slide-in card
 * pinned to the top-right corner. It never blocks the interface, so it can be
 * shown even while a movie is playing.
 *
 * Once a message is dismissed it is recorded server-side (see
 * POST /api/messages/[id]/read) so it pops exactly once per account — it will
 * not reappear on a new login/session of the same account. localStorage is only
 * a fast-path mirror.
 */
export function MessageToast(_props: MessageToastProps) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [accountId, setAccountId] = useState<string | undefined>();
  const [openIndex, setOpenIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchUserId() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.accountId) {
            setAccountId(data.data.accountId);
          }
        }
      } catch {}
    }
    fetchUserId();
  }, []);

  useEffect(() => {
    if (!accountId) return;
    const key = getSeenKey(accountId);

    async function poll() {
      try {
        const res = await fetch("/api/messages", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        const seen = loadSeen(key);
        const all = (data.data?.messages || []) as AdminMessage[];
        const fresh = all.filter((m) => !seen.includes(m.id));

        if (fresh.length > 0) {
          setMessages((prev) => {
            const merged = [...fresh.filter((m) => !prev.some((p) => p.id === m.id)), ...prev];
            return merged;
          });
          setOpenIndex(0);
        }
      } catch {}
    }

    poll();
    timerRef.current = setInterval(poll, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [accountId]);

  // Persist "seen" locally (fast path) and on the server (authoritative, so
  // the message never reappears for this account on another device/session).
  async function markViewed(id: string) {
    const key = getSeenKey(accountId);
    try {
      const seen = loadSeen(key);
      if (!seen.includes(id)) {
        seen.push(id);
        localStorage.setItem(key, JSON.stringify(seen.slice(-100)));
      }
    } catch {}
    try {
      await fetch(`/api/messages/${id}/read`, { method: "POST" });
    } catch {
      // Server unreachable — local mirror still suppresses repeat pops.
    }
  }

  function dismiss(id: string) {
    markViewed(id);
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (openIndex >= next.length) setOpenIndex(Math.max(0, next.length - 1));
      return next;
    });
  }

  const current = messages[openIndex];

  return (
    <div className="pointer-events-none fixed top-14 right-3 sm:top-20 sm:right-6 z-[80] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-3">
      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="pointer-events-auto glass-panel relative rounded-2xl border-white/15 p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e50914]/15 ring-1 ring-[#e50914]/40">
                <Megaphone className="h-4 w-4 text-[#e50914]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Message</p>
                <p className="mt-0.5 text-xs font-bold text-white leading-relaxed whitespace-pre-wrap line-clamp-4">
                  {current.message}
                </p>
                {messages.length > 1 && (
                  <p className="mt-1 text-[10px] font-semibold text-neutral-500">
                    {openIndex + 1} of {messages.length}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(current.id)}
                className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {messages.length > 1 && (
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenIndex((i) => Math.min(i + 1, messages.length - 1))}
                  className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-white/10"
                >
                  Next
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}