"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";

interface AccountCountdownBannerProps {
  expiresAt: string;
  startedAt?: string | null;
  username: string;
}

interface TimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeParts(msLeft: number): TimeParts {
  const total = Math.max(0, msLeft);
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
  };
}

const pad = (n: number) => n.toString().padStart(2, "0");

export function AccountCountdownBanner({
  expiresAt,
  startedAt,
  username,
}: AccountCountdownBannerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, diff);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setTimeLeft(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Remaining fraction of the full subscription period
  const progress = useMemo(() => {
    if (!startedAt) return null;
    const started = new Date(startedAt).getTime();
    const end = new Date(expiresAt).getTime();
    const total = end - started;
    if (total <= 0) return 0;
    return Math.min(1, Math.max(0, timeLeft / total));
  }, [startedAt, expiresAt, timeLeft]);

  const parts = getTimeParts(timeLeft);
  const expired = timeLeft <= 0;
  const isCritical = timeLeft < 1000 * 60 * 60 * 24;
  const isUrgent = timeLeft < 1000 * 60 * 60 * 24 * 3;

  const accentColor = expired
    ? "#dc2626"
    : isCritical
      ? "#dc2626"
      : isUrgent
        ? "#f59e0b"
        : "#34d399";

  const progressColor = expired
    ? "#dc2626"
    : isCritical
      ? "#f87171"
      : isUrgent
        ? "#fbbf24"
        : "#34d399";

  const sections = [
    { label: "Days", value: pad(parts.days) },
    { label: "Hrs", value: pad(parts.hours) },
    { label: "Min", value: pad(parts.minutes) },
    { label: "Sec", value: pad(parts.seconds) },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] border-b border-white/10 bg-black/70 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-2 md:px-8">
        {/* Left: account identity */}
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="relative flex h-2 w-2 flex-shrink-0"
            aria-hidden
          >
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${expired ? "bg-red-500" : "bg-brand"}`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${expired ? "bg-red-500" : "bg-brand"}`}
            />
          </span>
          <span className="truncate text-sm text-white/80">
            {username}
            <span className="mx-2 text-white/25">•</span>
            <span className="hidden text-white/50 sm:inline">
              {expired ? "Subscription ended" : "Subscriber"}
            </span>
          </span>
        </div>

        {/* Right: segmented timer */}
        {expired ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-red-400">
            <Timer className="h-4 w-4" />
            EXPIRED — contact administrator to renew
          </div>
        ) : (
          <motion.div
            key={accentColor}
            initial={{ opacity: 0.6, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-1.5"
          >
            <Timer
              className="mr-0.5 h-4 w-4 flex-shrink-0"
              style={{ color: accentColor }}
            />
            {sections.map((section, index) => (
              <div
                key={section.label}
                className="flex items-center gap-1.5"
              >
                <div className="flex flex-col items-center rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
                  <span
                    className="font-mono text-xs font-bold leading-tight tabular-nums tracking-wide sm:text-sm"
                    style={{ color: accentColor }}
                  >
                    {section.value}
                  </span>
                </div>
                <span className="hidden text-[10px] font-medium uppercase tracking-wider text-white/40 sm:inline">
                  {section.label}
                </span>
                {index < sections.length - 1 && (
                  <span className="text-white/20">:</span>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Progress line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
        {progress !== null && !expired && (
          <motion.div
            className="h-full"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 1 }}
            style={{ backgroundColor: progressColor }}
          />
        )}
        {expired && (
          <div className="h-full w-full bg-red-500/70" />
        )}
      </div>
    </div>
  );
}
