"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Film,
  Tv,
  Filter,
  X,
  Sparkles,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentCard } from "@/components/home/content-card";
import { NetflixNavbar } from "@/components/layout/netflix-navbar";
import type { Profile, Media, MediaType } from "@/types";

const SORT_OPTIONS = [
  { value: "createdAt", label: "Date Added" },
  { value: "title", label: "Title (A-Z)" },
  { value: "releaseYear", label: "Release Year" },
  { value: "rating", label: "Rating" },
];

const GENRE_OPTIONS = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
];

export default function BrowsePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const profileId = params.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [mediaType, setMediaType] = useState<MediaType | "">(
    (searchParams.get("type") as MediaType) || ""
  );
  const [genre, setGenre] = useState(searchParams.get("genre") || "");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    (searchParams.get("order") as "asc" | "desc") || "desc"
  );
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (profile) {
      fetchMedia();
    }
  }, [profile, mediaType, genre, sortBy, sortOrder, page]);

  async function checkAuth() {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (data.success && data.data) {
        setProfile(data.data);
      } else {
        router.push("/login");
      }
    } catch {
      router.push("/login");
    }
  }

  async function fetchMedia() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (mediaType) q.set("type", mediaType);
      if (genre) q.set("genre", genre);
      q.set("sort", sortBy);
      q.set("order", sortOrder);
      q.set("page", page.toString());
      q.set("limit", "24");

      const response = await fetch(`/api/media?${q.toString()}`);
      const data = await response.json();

      if (data.success) {
        setMedia(data.data.media);
        setTotalPages(data.data.pagination.totalPages);
        setTotalCount(data.data.pagination.total);
      }
    } catch (error) {
      console.error("Failed to fetch media:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = (newType?: string, newGenre?: string) => {
    setPage(1);
    if (newType !== undefined) setMediaType(newType as MediaType | "");
    if (newGenre !== undefined) setGenre(newGenre);
  };

  if (!profile) {
    return (
      <div className="cinematic-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-white select-none">
      <NetflixNavbar profile={profile} />

      <main className="mx-auto max-w-7xl px-4 sm:px-8 md:px-12 pt-28 pb-24">
        {/* Page Title & Filter Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {mediaType === "movie"
                ? "Movies"
                : mediaType === "series"
                ? "TV Series"
                : "Browse Vault"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-neutral-400">
              Explore {totalCount} titles available in high definition
            </p>
          </div>

          {/* Quick Category Tabs (All / Movies / Series) */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#121215] p-1 shadow-md">
            <button
              type="button"
              onClick={() => handleFilterChange("")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                mediaType === ""
                  ? "bg-[#e50914] text-white shadow-md shadow-red-950/60"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("movie")}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                mediaType === "movie"
                  ? "bg-[#e50914] text-white shadow-md shadow-red-950/60"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Film className="h-3.5 w-3.5" />
              Movies
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("series")}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                mediaType === "series"
                  ? "bg-[#e50914] text-white shadow-md shadow-red-950/60"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Tv className="h-3.5 w-3.5" />
              Series
            </button>
          </div>
        </div>

        {/* Genre Filter Scroll Strip */}
        <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            type="button"
            onClick={() => handleFilterChange(undefined, "")}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              genre === ""
                ? "border border-white/40 bg-white/20 text-white shadow-sm"
                : "border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            All Genres
          </button>
          {GENRE_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => handleFilterChange(undefined, g)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                genre === g
                  ? "border border-red-500/60 bg-[#e50914] text-white shadow-md shadow-red-950/50"
                  : "border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Media Grid */}
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
          </div>
        ) : media.length === 0 ? (
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[#121215] p-12 text-center shadow-xl">
            <Film className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
            <h3 className="text-xl font-bold text-white">No Matching Titles</h3>
            <p className="mt-2 text-xs text-neutral-400">
              Try selecting a different genre or clearing your filters.
            </p>
            <Button
              onClick={() => {
                setMediaType("");
                setGenre("");
                setPage(1);
              }}
              className="btn-brand mt-6 rounded-xl"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 md:gap-6">
              {media.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  profileId={profileId}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border-white/15 bg-white/5"
                >
                  Previous
                </Button>

                <span className="text-xs font-semibold text-neutral-400 px-2">
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-xl border-white/15 bg-white/5"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
