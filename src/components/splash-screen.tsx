"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, FastForward } from "lucide-react";
import { playCinematicSound } from "@/lib/cinematic-audio";

interface SplashScreenProps {
  onComplete: () => void;
  brandName?: string;
  tagline?: string;
}

type SplashPhase = "intro" | "pop" | "reveal" | "out" | "done";

// Netflix-N-style premium "M" logo pop.
//
// Timeline (all in ms):
//   0     -> draw the M strokes (ribbon reveal), glow builds
//   700   -> the logo "pops": scales up with an overshoot + settle (the
//            satisfying N-style snap), a red bloom bursts, sheen sweeps peak
//   1800  -> wordmark + tagline fade/slide in
//   2800  -> the logo rushes TOWARD the viewer and blows PAST the camera
//            (massive zoom to 14x + blur), like the N flying through you
//   3400  -> done, then redirect
export function SplashScreen({
  onComplete,
  brandName = "MOVIEFLIX",
  tagline = "CINEMATIC ENTERTAINMENT PLATFORM",
}: SplashScreenProps) {
  // Dev/demo helper: `?sph=<phase>` freezes the splash at a given phase so it
  // can be screenshotted. No effect in normal usage (no query param present).
  const HOLD_PHASES = ["intro", "pop", "reveal", "out", "done"] as const;
  const readHold = (): SplashPhase | null => {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get("sph");
    return raw && (HOLD_PHASES as readonly string[]).includes(raw) ? (raw as SplashPhase) : null;
  };
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<SplashPhase>(() => readHold() ?? "intro");
  const audioPlayedRef = useRef(false);

  const triggerAudio = useCallback(() => {
    if (!audioPlayedRef.current && !muted) {
      audioPlayedRef.current = true;
      playCinematicSound(0.8);
    }
  }, [muted]);

  const handleSkip = useCallback(() => {
    setPhase("done");
    onComplete();
  }, [onComplete]);

  // Skip via Escape / Space / Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSkip]);

  useEffect(() => {
    // When holding a phase for a screenshot, don't run the auto-timeline.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sph")) return;

    // Attempt audio shortly after mount (best-effort autoplay).
    const audioTimer = setTimeout(() => {
      triggerAudio();
    }, 300);

    const tPop = setTimeout(() => setPhase("pop"), 700);
    const tReveal = setTimeout(() => setPhase("reveal"), 1800);
    const tOut = setTimeout(() => setPhase("out"), 2800);
    const tDone = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 3400);

    return () => {
      clearTimeout(audioTimer);
      clearTimeout(tPop);
      clearTimeout(tReveal);
      clearTimeout(tOut);
      clearTimeout(tDone);
    };
  }, [onComplete, triggerAudio]);

  if (phase === "done") return null;

  const popActive = phase === "pop" || phase === "reveal" || phase === "out";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-black select-none"
        onClick={triggerAudio}
        initial={{ opacity: 1 }}
        animate={{
          // Keep the overlay full-opacity during the "pass-through" zoom so the
          // logo rushes past the camera instead of fading out prematurely.
          opacity: 1,
        }}
        transition={{ duration: 0.25, ease: "easeIn" }}
        exit={{ opacity: 0 }}
      >
        {/* Center-stage red bloom behind the logo on pop */}
        <AnimatePresence>
          {popActive && (
            <motion.div
              className="pointer-events-none absolute top-1/2 left-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0, 1, 0.85], scale: [0.2, 1.5, 1.15] }}
              exit={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              style={{
                background:
                  "radial-gradient(circle, rgba(229,9,20,0.55) 0%, rgba(229,9,20,0.18) 45%, rgba(0,0,0,0) 70%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Inner hot core flash at the exact pop moment */}
        <AnimatePresence>
          {phase === "pop" && (
            <motion.div
              className="pointer-events-none absolute top-1/2 left-1/2 h-[36vmin] w-[36vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.3, 1.6, 2.2] }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,90,103,0.7) 40%, rgba(229,9,20,0) 70%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* The M logo */}
        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial="intro"
          animate={phase}
        >
          <motion.div
            className="relative flex items-center justify-center"
            style={{ perspective: 900 }}
            animate={{
              // The N-style pop: ease up with a pronounced overshoot, then settle.
              scale:
                phase === "intro"
                  ? [0.82, 1]
                  : phase === "pop"
                  ? [1, 1.2, 0.94, 1.08, 1]
                  : phase === "reveal"
                  ? 1
                  : phase === "out"
                  ? [1, 14]
                  : 1,
              filter:
                phase === "pop"
                  ? ["brightness(1)", "brightness(1.5)", "brightness(1)"]
                  : phase === "out"
                  ? ["brightness(1) blur(0px)", "brightness(2.4) blur(10px)"]
                  : "brightness(1) blur(0px)",
            }}
            transition={
              phase === "pop"
                ? { duration: 0.65, times: [0, 0.4, 0.6, 0.8, 1], ease: [0.16, 1, 0.3, 1] }
                : phase === "out"
                ? { duration: 0.5, ease: "easeIn" }
                : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
            }
          >
            {/* Sheen that sweeps the M's peak at the pop moment */}
            <AnimatePresence>
              {(phase === "pop" || phase === "reveal") && (
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.7) 50%, transparent 65%)",
                    mixBlendMode: "screen",
                  }}
                />
              )}
            </AnimatePresence>

            <svg
              viewBox="0 0 240 240"
              className="h-44 w-44 md:h-64 md:w-64 drop-shadow-[0_0_60px_rgba(229,9,20,0.85)]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="mSplashLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#b20710" />
                  <stop offset="45%" stopColor="#e50914" />
                  <stop offset="100%" stopColor="#ff3b47" />
                </linearGradient>
                <linearGradient id="mSplashRight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#800208" />
                  <stop offset="55%" stopColor="#e50914" />
                  <stop offset="100%" stopColor="#ff5964" />
                </linearGradient>
                <linearGradient id="mSplashDiag" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff5964" />
                  <stop offset="50%" stopColor="#e50914" />
                  <stop offset="100%" stopColor="#7a0006" />
                </linearGradient>
                <filter id="mSplashShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="-4" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.9" />
                </filter>
              </defs>

              {/* Left pillar */}
              <motion.path
                d="M 32 216 L 32 24 C 32 20, 36 16, 42 16 L 70 16 C 76 16, 80 20, 80 24 L 80 216 C 80 220, 76 224, 70 224 L 42 224 C 36 224, 32 220, 32 216 Z"
                fill="url(#mSplashLeft)"
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1, pathLength: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                style={{ originY: "100%" }}
              />
              {/* Right pillar */}
              <motion.path
                d="M 160 216 L 160 24 C 160 20, 164 16, 170 16 L 198 16 C 204 16, 208 20, 208 24 L 208 216 C 208 220, 204 224, 198 224 L 170 224 C 164 224, 160 220, 160 216 Z"
                fill="url(#mSplashRight)"
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
                style={{ originY: "100%" }}
              />
              {/* Left diagonal (valley down) */}
              <motion.path
                d="M 40 18 L 78 18 L 132 168 L 94 168 Z"
                fill="url(#mSplashDiag)"
                filter="url(#mSplashShadow)"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              />
              {/* Right diagonal (valley up) */}
              <motion.path
                d="M 108 168 L 146 168 L 200 18 L 162 18 Z"
                fill="url(#mSplashDiag)"
                filter="url(#mSplashShadow)"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.44 }}
              />
            </svg>
          </motion.div>

          {/* Wordmark + tagline */}
          <motion.div
            className="mt-8 flex flex-col items-center justify-center text-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{
              opacity: phase === "reveal" || phase === "out" ? 1 : 0,
              y: phase === "reveal" || phase === "out" ? 0 : 14,
              scale: phase === "out" ? [1, 6] : 1,
            }}
            transition={
              phase === "out"
                ? { duration: 0.5, ease: "easeIn" }
                : { duration: 0.6, ease: "easeOut" }
            }
          >
            <h1 className="bg-gradient-to-r from-white via-neutral-100 to-red-500 bg-clip-text font-extrabold tracking-[0.28em] text-3xl text-transparent uppercase drop-shadow-[0_4px_24px_rgba(229,9,20,0.6)] md:text-5xl">
              {brandName}
            </h1>
            <motion.div
              className="mt-3 h-[2px] bg-gradient-to-r from-transparent via-[#e50914] to-transparent shadow-[0_0_14px_#ff2a3a]"
              initial={{ width: 0 }}
              animate={{
                width: phase === "reveal" || phase === "out" ? "180px" : "0px",
              }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            />
            <p className="mt-3 text-[10px] font-semibold tracking-[0.35em] text-neutral-500 uppercase md:text-xs">
              {tagline}
            </p>
          </motion.div>
        </motion.div>

        {/* Controls */}
        <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMuted((prev) => {
                const next = !prev;
                if (!next) triggerAudio();
                return next;
              });
            }}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3.5 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-400" />}
            <span>{muted ? "Muted" : "Cinematic Audio"}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSkip();
            }}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:border-red-500/60 hover:bg-[#e50914] hover:text-white hover:shadow-[0_0_16px_rgba(229,9,20,0.6)] active:scale-95"
          >
            <span>Skip</span>
            <FastForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-6 text-center">
          <p className="text-[11px] tracking-wider text-white/30 uppercase">
            Click anywhere or press Space to skip
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
