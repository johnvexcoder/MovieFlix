"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  Search,
  X,
  Film,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ContentCard } from "@/components/home/content-card";
import { NetflixNavbar } from "@/components/layout/netflix-navbar";
import type { Profile, Media } from "@/types";

const SUGGESTED_TAGS = [
  "Action",
  "Sci-Fi",
  "Thriller",
  "Drama",
  "Crime",
  "Adventure",
  "4K Ultra HD",
];

function SearchContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const profileId = params.id as string;

  const initialQ = searchParams.get("q") || "";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(initialQ));

  useEffect(() => {
    checkAuth();
  }, []);

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

  const performSearch = useCallback(async (qStr: string) => {
    const trimmed = qStr.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(
        `/api/media?q=${encodeURIComponent(trimmed)}&limit=48`
      );
      const data = await response.json();

      if (data.success) {
        setResults(data.data.media);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

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
        {/* Search Bar Header */}
        <div className="mx-auto max-w-2xl mb-10">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-4.5 h-5 w-5 text-neutral-400" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, TV shows, actors, directors, genres…"
              className="h-14 rounded-2xl border-white/20 bg-white/5 pl-12 pr-12 text-base text-white placeholder:text-neutral-500 shadow-2xl focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/40 backdrop-blur-xl"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-4 p-1.5 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Quick Search Tag Suggestions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-neutral-400 mr-1">
              <TrendingUp className="h-3.5 w-3.5 text-[#e50914]" />
              Popular:
            </span>
            {SUGGESTED_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQuery(tag)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300 hover:border-white/30 hover:bg-white/10 hover:text-white transition-all"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
          </div>
        ) : !searched ? (
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[#121215] p-12 text-center shadow-xl">
            <Search className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
            <h3 className="text-xl font-bold text-white">Search Vault</h3>
            <p className="mt-2 text-xs text-neutral-400">
              Type a movie title, series name, or category above to instantly stream.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-[#121215] p-12 text-center shadow-xl">
            <Film className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
            <h3 className="text-xl font-bold text-white">No Results Found</h3>
            <p className="mt-2 text-xs text-neutral-400">
              Your search for “{query}” did not match any files in your library.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <p className="text-sm font-semibold text-neutral-300">
                Found <span className="text-[#e50914] font-bold">{results.length}</span> results for &ldquo;{query}&rdquo;
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 md:gap-6">
              {results.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  profileId={profileId}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="cinematic-bg flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
