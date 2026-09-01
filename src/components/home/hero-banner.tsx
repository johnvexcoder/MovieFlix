"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Info,
  Star,
  Clock,
  Sparkles,
  Film,
  Tv,
  ChevronLeft,
  ChevronRight,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Media } from "@/types";

interface HeroBannerProps {
  items: Media[];
  profileId: string;
}

export function HeroBanner({ items, profileId }: HeroBannerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-rotate every 3 seconds unless hovered
  useEffect(() => {
    if (items.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [items.length, isHovered]);

  if (items.length === 0) {
    return (
      <div className="relative flex h-[70vh] min-h-[500px] w-full items-center justify-center bg-gradient-to-br from-neutral-900 via-black to-neutral-950">
        <div className="flex flex-col items-center gap-3 text-center">
          <Film className="h-12 w-12 text-neutral-600 animate-pulse" />
          <p className="text-sm font-medium text-neutral-400">Scan media libraries to populate featured spotlight</p>
        </div>
      </div>
    );
  }

  const safeIndex = currentIndex % items.length;
  const item = items[safeIndex] || items[0];
  const backdropUrl = `/api/media/${item.id}/image?kind=backdrop`;

  // Check if added within 48 hours
  const isWithin48h = item.createdAt
    ? new Date(item.createdAt).getTime() >= Date.now() - 48 * 60 * 60 * 1000
    : true;

  // Parse genres
  let parsedGenres: string[] = [];
  if (item.genres) {
    try {
      parsedGenres = JSON.parse(item.genres);
    } catch {
      // fallback
    }
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div
      className="group/hero relative h-[85vh] min-h-[580px] max-h-[850px] w-full overflow-hidden select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Hero Artwork (Wide Banner, 1 movie per slide) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={item.title}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-neutral-900 via-[#0a0a0f] to-black" />
          )}

          {/* Multi-Layer Cinematic Gradient Masking */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#08080a] via-[#08080a]/75 to-transparent max-w-4xl" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#08080a]/80 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Manual Navigation Chevrons on Hover */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex h-14 w-11 items-center justify-center rounded-xl bg-black/60 text-white backdrop-blur-md border border-white/10 opacity-0 group-hover/hero:opacity-100 hover:bg-[#e50914] hover:border-transparent transition-all duration-200"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex h-14 w-11 items-center justify-center rounded-xl bg-black/60 text-white backdrop-blur-md border border-white/10 opacity-0 group-hover/hero:opacity-100 hover:bg-[#e50914] hover:border-transparent transition-all duration-200"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Main Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 md:px-16 pb-20 md:pb-28">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl space-y-4 md:space-y-5"
        >
          {/* Top Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Added Today / 48h Spotlight Badge */}
            {isWithin48h && (
              <div className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-blue-950/60 ring-1 ring-blue-400/40">
                <Flame className="h-3 w-3" />
                <span>New on MovieFlix (48h)</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 rounded-full bg-[#e50914] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-red-950/60">
              <Sparkles className="h-3 w-3" />
              <span>Spotlight</span>
            </div>

            {item.type === "series" ? (
              <span className="badge-quality border-purple-500/30 text-purple-300 bg-purple-950/30">
                <Tv className="mr-1 h-3 w-3" /> TV SERIES
              </span>
            ) : (
              <span className="badge-quality border-blue-500/30 text-blue-300 bg-blue-950/30">
                <Film className="mr-1 h-3 w-3" /> MOVIE
              </span>
            )}

            <span className="badge-quality border-white/20 text-neutral-200">
              4K Ultra HD
            </span>

            {item.rating && item.rating > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                <Star className="h-3.5 w-3.5 fill-current text-emerald-400" />
                {Math.round(item.rating * 10)}% Match
              </span>
            )}

            {item.year && (
              <span className="text-xs font-semibold text-neutral-300">
                {item.year}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] line-clamp-2">
            {item.title}
          </h1>

          {/* Overview / Synopsis */}
          <p className="line-clamp-3 text-sm sm:text-base md:text-lg text-neutral-300/90 drop-shadow-md max-w-xl font-normal leading-relaxed">
            {item.overview || "Stream this new release now in ultra high definition."}
          </p>

          {/* Genres Chips */}
          {parsedGenres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {parsedGenres.slice(0, 4).map((g) => (
                <span
                  key={g}
                  className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] font-medium text-neutral-300 backdrop-blur-md"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => router.push(`/profiles/${profileId}/watch/${item.id}?autoplay=1`)}
              className="h-12 sm:h-14 rounded-xl bg-white px-8 text-base font-bold text-black shadow-2xl transition-all duration-200 hover:bg-neutral-200 hover:scale-105 active:scale-95"
            >
              <Play className="mr-2 h-5 w-5 fill-black text-black" />
              Play Now
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={() => router.push(`/profiles/${profileId}/media/${item.id}`)}
              className="btn-secondary-netflix h-12 sm:h-14 rounded-xl px-6 text-base font-bold hover:scale-105 active:scale-95"
            >
              <Info className="mr-2 h-5 w-5" />
              More Info
            </Button>
          </div>
        </motion.div>
      </div>

      {/* 3-Second Visual Progress Pill Indicators (Bottom Right) */}
      {items.length > 1 && (
        <div className="absolute bottom-10 right-6 md:right-16 z-20 flex items-center gap-2">
          {items.map((it, idx) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setCurrentIndex(idx)}
              className="relative h-2 rounded-full overflow-hidden bg-white/25 transition-all duration-300"
              style={{ width: idx === safeIndex ? "40px" : "12px" }}
            >
              {idx === safeIndex && (
                <motion.div
                  key={`progress-${idx}`}
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "linear" }}
                  className="h-full bg-[#e50914] shadow-md shadow-red-950/60"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
