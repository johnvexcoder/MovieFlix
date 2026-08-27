"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  Play,
  Star,
  Clock,
  Calendar,
  Film,
  Tv,
  Plus,
  Check,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NetflixNavbar } from "@/components/layout/netflix-navbar";
import type { Profile, Media } from "@/types";

interface Season {
  id: string;
  seasonNumber: number;
  title: string | null;
  overview: string | null;
  posterPath: string | null;
  episodeCount: number;
}

interface Episode {
  id: string;
  episodeNumber: number;
  seasonNumber: number;
  title: string | null;
  overview: string | null;
  stillPath: string | null;
  durationMinutes: number | null;
}

interface MediaDetail extends Media {
  seasons?: Season[];
  episodes?: Episode[];
}

export default function MediaDetailPage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const mediaId = params.mediaId as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [media, setMedia] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [inList, setInList] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchMedia();
  }, [mediaId]);

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
    try {
      const response = await fetch(`/api/media/${mediaId}`);
      const data = await response.json();
      if (data.success) {
        setMedia(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch media:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="cinematic-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  if (!media) {
    return (
      <div className="cinematic-bg flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <Film className="mx-auto mb-4 h-16 w-16 text-neutral-600" />
        <h2 className="text-2xl font-bold text-white">Media Not Found</h2>
        <p className="mt-2 text-sm text-neutral-400">
          This title is not currently available in your streaming library.
        </p>
        <Button
          className="btn-brand mt-6 rounded-xl"
          onClick={() => router.push(`/profiles/${profileId}/home`)}
        >
          Back to Home
        </Button>
      </div>
    );
  }

  const backdropUrl = media.backdropUrl || media.posterUrl;
  const posterUrl = media.posterUrl;

  let genres: string[] = [];
  if (media.genres) {
    try {
      genres = JSON.parse(media.genres);
    } catch {}
  }

  const seasons = media.seasons || [];
  const episodes = media.episodes || [];
  const seasonEpisodes = episodes.filter((ep) => ep.seasonNumber === selectedSeason);
  const matchPercent = media.rating ? Math.min(99, Math.round(media.rating * 10 + 6)) : 95;

  return (
    <div className="min-h-screen bg-[#08080a] text-white select-none">
      <NetflixNavbar profile={profile} />

      {/* Hero Backdrop Spotlight */}
      <section className="relative min-h-[60vh] md:min-h-[75vh] w-full overflow-hidden">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt={media.title}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-950" />
        )}

        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08080a] via-[#08080a]/75 to-transparent" />

        {/* Back Button (Mobile/Tablet) */}
        <div className="absolute top-20 left-4 sm:left-8 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Content Details */}
        <div className="relative z-20 flex min-h-[60vh] md:min-h-[75vh] flex-col justify-end px-4 sm:px-8 md:px-16 pb-12 pt-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col md:flex-row gap-8 items-start md:items-end"
          >
            {/* Poster Thumbnail (Desktop) */}
            {posterUrl && (
              <div className="hidden lg:block w-52 flex-shrink-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
                <img src={posterUrl} alt={media.title} className="w-full object-cover" />
              </div>
            )}

            {/* Information Pillar */}
            <div className="max-w-3xl space-y-4">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {media.type === "series" ? (
                  <span className="badge-quality border-purple-500/40 text-purple-300 bg-purple-950/40">
                    <Tv className="mr-1 h-3 w-3" /> TV SERIES
                  </span>
                ) : (
                  <span className="badge-quality border-blue-500/40 text-blue-300 bg-blue-950/40">
                    <Film className="mr-1 h-3 w-3" /> MOVIE
                  </span>
                )}

                <span className="text-xs font-bold text-emerald-400">
                  {matchPercent}% Match
                </span>

                {media.year && (
                  <span className="text-xs font-semibold text-neutral-300">
                    {media.year}
                  </span>
                )}

                <span className="badge-quality text-white">4K UHD</span>
                <span className="badge-quality text-white">HDR</span>
                <span className="badge-quality text-white">Dolby Atmos</span>

                {media.durationMinutes && (
                  <span className="flex items-center gap-1 text-xs text-neutral-300">
                    <Clock className="h-3.5 w-3.5 text-neutral-400" />
                    {Math.floor(media.durationMinutes / 60)}h {media.durationMinutes % 60}m
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-lg">
                {media.title}
              </h1>

              {/* Overview */}
              <p className="text-base sm:text-lg text-neutral-300 leading-relaxed max-w-2xl">
                {media.overview || "Stream this title in crystal clear high definition audio and video."}
              </p>

              {/* Genres */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-neutral-300"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Button
                  size="lg"
                  onClick={() => router.push(`/profiles/${profileId}/watch/${media.id}`)}
                  className="btn-brand h-13 rounded-xl px-8 text-base font-bold shadow-2xl hover:scale-105 active:scale-95"
                >
                  <Play className="mr-2 h-5 w-5 fill-white text-white" />
                  Play {media.type === "series" ? "Episode 1" : "Movie"}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setInList(!inList)}
                  className="rounded-xl border-white/20 bg-white/5 h-13 px-6 text-sm font-semibold text-white hover:bg-white/15"
                >
                  {inList ? <Check className="mr-2 h-4 w-4 text-emerald-400" /> : <Plus className="mr-2 h-4 w-4" />}
                  {inList ? "In My List" : "Add to List"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Series: Season Tabs & Episodes Grid */}
      {media.type === "series" && (
        <section className="mx-auto max-w-7xl px-4 sm:px-8 md:px-16 py-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold tracking-tight text-white">Episodes</h2>

            {/* Season Selector Tabs */}
            {seasons.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {seasons.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => setSelectedSeason(season.seasonNumber)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                      selectedSeason === season.seasonNumber
                        ? "bg-[#e50914] text-white shadow-lg shadow-red-950/60"
                        : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    Season {season.seasonNumber}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Episode Cards */}
          <div className="space-y-4">
            {seasonEpisodes.length > 0 ? (
              seasonEpisodes.map((episode) => (
                <div
                  key={episode.id}
                  onClick={() =>
                    router.push(
                      `/profiles/${profileId}/watch/${media.id}?episode=${episode.id}`
                    )
                  }
                  className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-white/10 bg-[#121215]/80 p-4 transition-all duration-200 hover:border-white/30 hover:bg-[#18181f] cursor-pointer"
                >
                  {/* Episode Thumbnail */}
                  <div className="relative aspect-video w-full sm:w-48 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-900 shadow-md">
                    {episode.stillPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w300${episode.stillPath}`}
                        alt={episode.title || ""}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-neutral-800">
                        <Tv className="h-6 w-6 text-neutral-600" />
                      </div>
                    )}
                    {/* Hover Play Circle */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e50914] shadow-lg text-white">
                        <Play className="h-5 w-5 fill-white text-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Episode Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors">
                        {episode.episodeNumber}. {episode.title || "Episode"}
                      </h3>
                      {episode.durationMinutes && (
                        <span className="text-xs font-semibold text-neutral-400">
                          {episode.durationMinutes}m
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-neutral-400 leading-relaxed">
                      {episode.overview || "No episode summary available."}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-12 text-center text-sm text-neutral-400">
                No episode files scanned for Season {selectedSeason} yet.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
