"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Plus,
  Check,
  ChevronDown,
  Star,
  Film,
  Tv,
  Clock,
  Sparkles,
} from "lucide-react";
import type { Media } from "@/types";

interface ContentCardProps {
  item: Media;
  profileId: string;
  showProgress?: boolean;
  progress?: number;
}

export function ContentCard({
  item,
  profileId,
  showProgress = false,
  progress = 0,
}: ContentCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [inList, setInList] = useState(false);

  const posterUrl = `/api/media/${item.id}/image?kind=poster`;
  const backdropUrl = `/api/media/${item.id}/image?kind=backdrop`;

  // Parse genres
  let parsedGenres: string[] = [];
  if (item.genres) {
    try {
      parsedGenres = JSON.parse(item.genres);
    } catch {
      // fallback
    }
  }

  const matchPercent = item.rating ? Math.min(99, Math.round(item.rating * 10 + 8)) : 94;

  const isNewlyAdded = item.createdAt
    ? new Date(item.createdAt).getTime() >= Date.now() - 48 * 60 * 60 * 1000
    : true;

  return (
    <div
      className="relative w-[150px] sm:w-[170px] md:w-[210px] lg:w-[230px] flex-shrink-0 cursor-pointer select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => router.push(`/profiles/${profileId}/media/${item.id}`)}
    >
      {/* Base Poster Card */}
      <div className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-neutral-900 shadow-lg transition-all duration-300 group-hover:shadow-2xl">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 p-3 text-center">
            {item.type === "series" ? (
              <Tv className="mb-2 h-8 w-8 text-neutral-600" />
            ) : (
              <Film className="mb-2 h-8 w-8 text-neutral-600" />
            )}
            <p className="line-clamp-2 text-xs font-semibold text-neutral-300">
              {item.title}
            </p>
          </div>
        )}

        {/* Ambient Top & Bottom Vignettes */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        {/* Top Left Badges (Series / Movie) */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {item.type === "series" ? (
            <span className="rounded bg-purple-600/90 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-white uppercase shadow-sm">
              SERIES
            </span>
          ) : (
            <span className="rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-white uppercase shadow-sm">
              MOVIE
            </span>
          )}
        </div>

        {/* Top Right: Small Blue 'NEW' Tag or Rating Star Badge */}
        {isNewlyAdded ? (
          <div className="absolute top-2 right-2 flex items-center rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md shadow-blue-950/60 ring-1 ring-blue-400/50">
            NEW
          </div>
        ) : item.rating && item.rating > 0 ? (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 backdrop-blur-md">
            <Star className="h-2.5 w-2.5 fill-current text-yellow-400" />
            <span>{item.rating.toFixed(1)}</span>
          </div>
        ) : null}

        {/* Bottom Progress Bar (Continue Watching) */}
        {showProgress && progress > 0 && (
          <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1.5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-300 mb-1">
              <span>Resume</span>
              <span className="text-[#e50914]">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[#e50914] shadow-[0_0_8px_#e50914]"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Card Title Underneath */}
      <div className="mt-2 space-y-0.5 px-0.5">
        <h3 className="line-clamp-1 text-xs sm:text-sm font-semibold text-neutral-200 transition-colors group-hover:text-white">
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-[11px] font-medium text-neutral-400">
          <span className="text-emerald-400 font-bold">{matchPercent}% Match</span>
          {item.year && <span>{item.year}</span>}
        </div>
      </div>
    </div>
  );
}
