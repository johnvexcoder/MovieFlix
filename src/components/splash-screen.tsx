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

// Generate high-intensity light rays with varying angles, colors, and speeds
const LIGHT_RAYS = Array.from({ length: 42 }).map((_, i) => {
  const angle = (i / 42) * 360;
  const colors = [
    "#e50914", // Netflix Red
    "#ff2a3a", // Hot Ruby
    "#ff6b00", // Laser Orange
    "#ff007f", // Electric Magenta
    "#8a2be2", // Laser Violet
    "#00d2ff", // Cyan Laser
    "#ffffff", // Core White
  ];
  return {
    id: i,
    angle,
    length: 300 + (i % 7) * 90,
    width: 2 + (i % 5) * 1.8,
    color: colors[i % colors.length],
    delay: 1.8 + (i % 10) * 0.04,
    speed: 0.9 + (i % 4) * 0.25,
    blur: (i % 3) * 2,
  };
});

// Cinematic dust/star particles
const COSMIC_PARTICLES = Array.from({ length: 50 }).map((_, i) => ({
  id: i,
  x: (Math.sin(i * 99) * 50 + 50) + "%",
  y: (Math.cos(i * 77) * 50 + 50) + "%",
  size: 1 + (i % 3),
  opacity: 0.2 + (i % 5) * 0.15,
  duration: 3 + (i % 4),
}));

export function SplashScreen({
  onComplete,
  brandName = "MOVIEFLIX",
  tagline = "CINEMATIC ENTERTAINMENT PLATFORM",
}: SplashScreenProps) {
  const [stage, setStage] = useState<"ignite" | "ribbons" | "prism" | "reveal" | "zoom" | "done">("ignite");
  const [muted, setMuted] = useState(false);
  const audioPlayedRef = useRef(false);

  const triggerAudio = useCallback(() => {
    if (!audioPlayedRef.current && !muted) {
      audioPlayedRef.current = true;
      playCinematicSound(0.85);
    }
  }, [muted]);

  const handleSkip = useCallback(() => {
    setStage("done");
    onComplete();
  }, [onComplete]);

  // Keyboard shortcut (Escape or Space to skip)
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
    // Attempt audio on initial mount (if browser allows autoplay)
    const audioTimer = setTimeout(() => {
      triggerAudio();
    }, 150);

    // Timeline of the cinematic orchestration
    const t1 = setTimeout(() => setStage("ribbons"), 400);   // Ribbon weaving
    const t2 = setTimeout(() => setStage("prism"), 1800);    // Hyperspace prism explosion
    const t3 = setTimeout(() => setStage("reveal"), 2700);   // Brand typography reveal
    const t4 = setTimeout(() => setStage("zoom"), 3700);     // Dimensional zoom transition
    const t5 = setTimeout(() => {
      setStage("done");
      onComplete();
    }, 4300);

    return () => {
      clearTimeout(audioTimer);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete, triggerAudio]);

  if (stage === "done") return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#050507] select-none cursor-pointer"
        onClick={() => {
          triggerAudio();
        }}
        initial={{ opacity: 1 }}
        animate={{
          opacity: stage === "zoom" ? 0 : 1,
          scale: stage === "zoom" ? 2.5 : 1,
          filter: stage === "zoom" ? "blur(12px) brightness(2.5)" : "none",
        }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Deep Atmospheric Backdrop Gradients */}
        <div className="pointer-events-none absolute inset-0">
          {/* Ambient red nebula core */}
          <motion.div
            className="absolute top-1/2 left-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
            animate={{
              background:
                stage === "prism" || stage === "zoom"
                  ? "radial-gradient(circle, rgba(229,9,20,0.55) 0%, rgba(138,43,226,0.3) 45%, rgba(0,0,0,0) 70%)"
                  : "radial-gradient(circle, rgba(229,9,20,0.35) 0%, rgba(229,9,20,0.1) 40%, rgba(0,0,0,0) 70%)",
              scale: stage === "prism" ? [1, 1.4, 1.2] : [0.8, 1.1, 1],
            }}
            transition={{ duration: 2.2, ease: "easeInOut" }}
          />

          {/* Secondary anamorphic violet-magenta flares */}
          <motion.div
            className="absolute top-1/2 left-1/2 h-[350px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] opacity-40"
            style={{
              background:
                "radial-gradient(ellipse, rgba(255,0,128,0.35) 0%, rgba(94,23,235,0.2) 50%, rgba(0,0,0,0) 80%)",
            }}
            animate={{
              scaleX: stage === "prism" ? [1, 2.2, 1.5] : [0.7, 1.2, 1],
              opacity: stage === "prism" ? [0.4, 0.85, 0.5] : 0.4,
            }}
            transition={{ duration: 1.8 }}
          />

          {/* Anamorphic Horizontal Laser Streak */}
          <motion.div
            className="absolute top-1/2 left-0 right-0 h-[2px] -translate-y-1/2 bg-gradient-to-r from-transparent via-[#ff2a3a] to-transparent shadow-[0_0_24px_#e50914]"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{
              scaleX: stage === "ignite" ? [0, 1] : stage === "prism" ? [1, 1.8, 1] : [1, 0.8],
              opacity: stage === "ignite" ? [0, 0.9] : stage === "prism" ? [0.9, 1, 0.4] : 0.3,
            }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>

        {/* Cosmic Floating Dust/Particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {COSMIC_PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-white"
              style={{
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.size,
                boxShadow: `0 0 ${p.size * 3}px rgba(255,255,255,0.8)`,
              }}
              animate={{
                y: ["-10px", "10px", "-10px"],
                opacity: [p.opacity * 0.4, p.opacity, p.opacity * 0.4],
                scale: stage === "prism" ? [1, 2.5, 0] : 1,
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* HYPERSPACE PRISM BURST RAYS (Shooting outward on impact) */}
        {(stage === "prism" || stage === "reveal" || stage === "zoom") && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {LIGHT_RAYS.map((ray) => (
              <motion.div
                key={ray.id}
                className="absolute origin-center"
                style={{
                  transform: `rotate(${ray.angle}deg)`,
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{
                  scaleY: [0, 1.4, 2.8],
                  opacity: [0, 0.95, 0],
                  scaleX: [1, 1.6, 0.2],
                }}
                transition={{
                  duration: ray.speed,
                  delay: ray.delay - 1.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div
                  style={{
                    height: `${ray.length}px`,
                    width: `${ray.width}px`,
                    background: `linear-gradient(to top, transparent 0%, ${ray.color} 50%, #ffffff 95%)`,
                    filter: `blur(${ray.blur}px) drop-shadow(0 0 8px ${ray.color})`,
                    transform: "translateY(-50%)",
                  }}
                />
              </motion.div>
            ))}

            {/* Shockwave Rings */}
            <motion.div
              className="absolute rounded-full border border-red-500/70"
              initial={{ width: 0, height: 0, opacity: 0.9 }}
              animate={{
                width: ["0px", "1200px"],
                height: ["0px", "1200px"],
                opacity: [0.9, 0],
              }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
            <motion.div
              className="absolute rounded-full border border-white/80"
              initial={{ width: 0, height: 0, opacity: 1 }}
              animate={{
                width: ["0px", "800px"],
                height: ["0px", "800px"],
                opacity: [1, 0],
              }}
              transition={{ duration: 1.0, delay: 0.1, ease: "easeOut" }}
            />
          </div>
        )}

        {/* MAIN CINEMATIC 3D RIBBON EMBLEM */}
        <div className="relative z-20 flex flex-col items-center">
          <motion.div
            className="relative flex items-center justify-center"
            initial={{ scale: 0.75, opacity: 0, rotateY: -15, rotateX: 10 }}
            animate={{
              scale:
                stage === "prism"
                  ? [1, 1.15, 1.05]
                  : stage === "reveal"
                  ? 1.0
                  : [0.75, 1],
              opacity: 1,
              rotateY: stage === "prism" ? [ -15, 0 ] : 0,
              rotateX: 0,
            }}
            transition={{
              duration: 1.2,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            style={{ perspective: 1200 }}
          >
            {/* SVG 3D Multi-Layered Laser Ribbons */}
            <svg
              viewBox="0 0 240 280"
              className="h-44 w-36 md:h-64 md:w-56 drop-shadow-[0_0_40px_rgba(229,9,20,0.7)]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Ribbon 1 Gradient (Left Vertical Pillar) */}
                <linearGradient id="ribbonLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#b20710" />
                  <stop offset="40%" stopColor="#e50914" />
                  <stop offset="85%" stopColor="#ff3849" />
                  <stop offset="100%" stopColor="#800208" />
                </linearGradient>

                {/* Ribbon 2 Gradient (Right Vertical Pillar) */}
                <linearGradient id="ribbonRight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#800208" />
                  <stop offset="30%" stopColor="#b20710" />
                  <stop offset="70%" stopColor="#e50914" />
                  <stop offset="100%" stopColor="#ff4d5a" />
                </linearGradient>

                {/* Ribbon 3 Gradient (Hyper Diagonal Slash - High Specular Energy) */}
                <linearGradient id="ribbonDiagonal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff5964" />
                  <stop offset="25%" stopColor="#ffffff" />
                  <stop offset="40%" stopColor="#ff2a3a" />
                  <stop offset="75%" stopColor="#e50914" />
                  <stop offset="100%" stopColor="#7a0006" />
                </linearGradient>

                {/* Specular Core Flare */}
                <radialGradient id="laserGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="35%" stopColor="#ff5a67" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="#e50914" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#e50914" stopOpacity="0" />
                </radialGradient>

                {/* Drop shadow for 3D ribbon overlap */}
                <filter id="ribbonShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="-4" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.8" />
                </filter>
              </defs>

              {/* 1. Left Vertical Pillar */}
              <motion.path
                d="M 28 245 L 28 35 C 28 28, 32 24, 38 24 L 66 24 C 72 24, 76 28, 76 35 L 76 245 C 76 252, 72 256, 66 256 L 38 256 C 32 256, 28 252, 28 245 Z"
                fill="url(#ribbonLeft)"
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{
                  scaleY: 1,
                  opacity: 1,
                }}
                transition={{
                  duration: 0.85,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.1,
                }}
                style={{ originY: "100%" }}
              />

              {/* 2. Right Vertical Pillar */}
              <motion.path
                d="M 164 245 L 164 35 C 164 28, 168 24, 174 24 L 202 24 C 208 24, 212 28, 212 35 L 212 245 C 212 252, 208 256, 202 256 L 174 256 C 168 256, 164 252, 164 245 Z"
                fill="url(#ribbonRight)"
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{
                  scaleY: 1,
                  opacity: 1,
                }}
                transition={{
                  duration: 0.85,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.25,
                }}
                style={{ originY: "100%" }}
              />

              {/* 3. Left-to-Center Diagonal Ribbon (M Valley Down) */}
              <motion.path
                d="M 38 26 L 76 26 L 132 186 L 94 186 Z"
                fill="url(#ribbonDiagonal)"
                filter="url(#ribbonShadow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                transition={{
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.45,
                }}
              />

              {/* 4. Center-to-Right Diagonal Ribbon (M Valley Up) */}
              <motion.path
                d="M 108 186 L 146 186 L 202 26 L 164 26 Z"
                fill="url(#ribbonDiagonal)"
                filter="url(#ribbonShadow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                transition={{
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.65,
                }}
              />

              {/* Specular Highlight Sheen Traveling across the M peak */}
              <motion.ellipse
                cx="120"
                cy="140"
                rx="42"
                ry="18"
                fill="url(#laserGlow)"
                initial={{ opacity: 0, x: -80, y: -80 }}
                animate={{
                  opacity: stage === "prism" ? [0, 1, 0] : [0, 0.85, 0],
                  x: [ -80, 0, 80 ],
                  y: [ -80, 0, 80 ],
                }}
                transition={{
                  duration: 1.1,
                  delay: 0.85,
                  ease: "easeInOut",
                }}
              />
            </svg>
          </motion.div>

          {/* TYPOGRAPHY REVEAL ("STREAMVAULT / MOVIEFLIX") */}
          <motion.div
            className="mt-6 flex flex-col items-center justify-center text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{
              opacity: stage === "reveal" || stage === "zoom" ? 1 : 0,
              y: stage === "reveal" || stage === "zoom" ? 0 : 16,
            }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {/* Main Wordmark */}
            <h1 className="relative font-extrabold tracking-[0.25em] text-3xl md:text-5xl uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-100 to-red-500 drop-shadow-[0_4px_24px_rgba(229,9,20,0.6)]">
              {brandName}
            </h1>

            {/* Ambient Laser Underline */}
            <motion.div
              className="mt-3 h-[2px] bg-gradient-to-r from-transparent via-[#e50914] to-transparent shadow-[0_0_12px_#ff2a3a]"
              initial={{ width: 0 }}
              animate={{
                width: stage === "reveal" || stage === "zoom" ? "180px" : "0px",
              }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            />

            {/* Sub-tagline */}
            <p className="mt-3 text-[10px] md:text-xs font-semibold tracking-[0.35em] text-neutral-400/90 uppercase">
              {tagline}
            </p>
          </motion.div>
        </div>

        {/* TOP / BOTTOM INTERACTIVE OVERLAYS */}
        <div className="absolute top-6 right-6 z-30 flex items-center gap-3">
          {/* Sound Toggle */}
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

          {/* Skip Intro Button */}
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

        {/* Subtle Bottom Instruction */}
        <div className="pointer-events-none absolute bottom-6 text-center">
          <p className="text-[11px] tracking-wider text-white/30 uppercase">
            Click anywhere or press Space to skip
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
