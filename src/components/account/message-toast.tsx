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
  variant: "sliding" | "fullscreen";
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
 * Polls /api/messages and displays new admin messages as either a sliding
 * toast (navbar pages) or a fullscreen overlay (watch page). Messages already
 * dismissed are remembered per account in localStorage.
 */
export function MessageToast({ variant }: MessageToastProps) {
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
          setMessages(fresh);
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

  function dismiss(id: string) {
    const key = getSeenKey(accountId);
    const seen = loadSeen(key);
    if (!seen.includes(id)) {
      seen.push(id);
      try {
        localStorage.setItem(key, JSON.stringify(seen.slice(-100)));
      } catch {}
    }
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (openIndex >= next.length) setOpenIndex(Math.max(0, next.length - 1));
      return next;
    });
  }

  function dismissAll() {
    messages.forEach((m) => dismiss(m.id));
  }

  const current = messages[openIndex];

  if (variant === "fullscreen") {
    return (
      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
            onClick={dismissAll}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="glass-panel relative w-full max-w-xl rounded-3xl border-white/20 p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => dismiss(current.id)}
                className="absolute top-3 right-3 rounded-full p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss message"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e50914]/15 ring-1 ring-[#e50914]/40">
                <Megaphone className="h-7 w-7 text-[#e50914]" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                Announcement from MovieFlix
              </p>
              <p className="mt-3 text-lg font-bold text-white leading-relaxed whitespace-pre-wrap">
                {current.message}
              </p>
              {messages.length > 1 && (
                <p className="mt-4 text-xs font-semibold text-neutral-500">
                  Message {openIndex + 1} of {messages.length}
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {messages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenIndex((i) => Math.min(i + 1, messages.length - 1));
                    }}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
                  >
                    Next
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(current.id)}
                  className="btn-brand rounded-xl px-6 py-2 text-xs font-bold"
                >
                  {messages.length > 1 ? "Dismiss" : "Got it"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Sliding variant
  return (
    <div className="pointer-events-none fixed top-20 right-4 sm:right-6 z-[80] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
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
                <p className="mt-0.5 text-xs font-bold text-white leading-relaxed whitespace-pre-wrap">
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