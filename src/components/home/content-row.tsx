"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { ContentCard } from "./content-card";
import type { Media } from "@/types";

interface ContentRowProps {
  title: string;
  items: Media[];
  profileId: string;
  showProgress?: boolean;
  progressMap?: Record<string, number>;
  categoryType?: string;
}

export function ContentRow({
  title,
  items,
  profileId,
  showProgress = false,
  progressMap = {},
  categoryType,
}: ContentRowProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
  }, [items]);

  const handleScroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    const targetScroll =
      direction === "left"
        ? scrollRef.current.scrollLeft - scrollAmount
        : scrollRef.current.scrollLeft + scrollAmount;

    scrollRef.current.scrollTo({
      left: targetScroll,
      behavior: "smooth",
    });

    setTimeout(checkScroll, 400);
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="group/row relative space-y-3">
      {/* Row Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>{title}</span>
            {title.includes("Trending") && (
              <Sparkles className="h-4 w-4 text-[#e50914]" />
            )}
          </h2>
          <span className="hidden sm:inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-400">
            {items.length}
          </span>
        </div>

        {categoryType && (
          <button
            type="button"
            onClick={() =>
              router.push(`/profiles/${profileId}/browse?genre=${encodeURIComponent(categoryType)}`)
            }
            className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            Explore All →
          </button>
        )}
      </div>

      {/* Slider Viewport Container */}
      <div className="relative -mx-4 px-4 sm:-mx-8 sm:px-8 md:-mx-12 md:px-12">
        {/* Left Paddle Button */}
        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => handleScroll("left")}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 flex h-20 w-11 items-center justify-center rounded-xl bg-black/70 text-white backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-200 hover:scale-110 hover:bg-[#e50914] hover:border-transparent opacity-0 group-hover/row:opacity-100"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}

        {/* Horizontal Scroll Cards List */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 sm:gap-4 md:gap-5 overflow-x-auto pb-4 pt-1 scrollbar-hide scroll-smooth"
        >
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              profileId={profileId}
              showProgress={showProgress}
              progress={progressMap[item.id] || 0}
            />
          ))}
        </div>

        {/* Right Paddle Button */}
        {canScrollRight && (
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => handleScroll("right")}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 flex h-20 w-11 items-center justify-center rounded-xl bg-black/70 text-white backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-200 hover:scale-110 hover:bg-[#e50914] hover:border-transparent opacity-0 group-hover/row:opacity-100"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>
    </div>
  );
}
