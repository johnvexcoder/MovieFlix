"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReminderData {
  reminderDays: number;
  reminderMessage: string;
  expiresAt: string | null;
}

export function ExpirationReminder() {
  const [data, setData] = useState<ReminderData | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/reminder", { cache: "no-store" });
        const json = await res.json();
        if (!json.success || mounted) {
          if (json.success && json.data) setData(json.data);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!data?.expiresAt || dismissed) return;
    const expiresAt = new Date(data.expiresAt).getTime();
    const diffMs = expiresAt - Date.now();
    const windowMs = data.reminderDays * 24 * 60 * 60 * 1000;
    if (diffMs > 0 && diffMs <= windowMs) {
      setShow(true);
    }
  }, [data, dismissed]);

  if (!data?.expiresAt || dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShow(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl border border-amber-400/30 bg-[#141416] p-6 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close reminder"
              onClick={() => setShow(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <CalendarClock className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-bold text-white">Subscription Expiring Soon</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">{data.reminderMessage}</p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Subscription Due On
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-amber-300">
                {new Date(data.expiresAt).toLocaleString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold hover:bg-white/15"
                onClick={() => setShow(false)}
              >
                Got it
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
