"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Info,
  Star,
  Clock,
  Volume2,
  VolumeX,
  Sparkles,
  Film,
  Tv,
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
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (items.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 9000);

    return () => clearInterval(timer);
  }, [items.length]);

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

  const item = items[currentIndex] || items[0];
  const backdropUrl = item.backdropUrl || item.posterUrl;

  // Parse genres
  let parsedGenres: string[] = [];
  if (item.genres) {
    try {
      parsedGenres = JSON.parse(item.genres);
    } catch {
      // fallback
    }
  }

  return (
    <div className="relative h-[85vh] min-h-[580px] max-h-[850px] w-full overflow-hidden select-none">
      {/* Background Hero Artwork */}
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={item.title}
              className="h-full w-full object-cover object-center"
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

      {/* Main Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 md:px-16 pb-20 md:pb-28">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl space-y-4 md:space-y-5"
        >
          {/* Top Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Top 10 / Featured Spotlight Badge */}
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

            <span className="badge-quality border-white/20 text-neutral-200">
              5.1 Surround
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
            {item.overview || "Stream this masterpiece now in ultra high definition."}
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
              onClick={() => router.push(`/profiles/${profileId}/watch/${item.id}`)}
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

      {/* Carousel Thumbnail Dots (Bottom Right) */}
      {items.length > 1 && (
        <div className="absolute bottom-10 right-6 md:right-16 z-20 flex items-center gap-2">
          {items.map((it, idx) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-8 bg-[#e50914] shadow-md shadow-red-950/60"
                  : "w-2 bg-white/30 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
