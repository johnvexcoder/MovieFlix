"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  FastForward,
  Settings,
  Tv,
  HelpCircle,
  PictureInPicture,
  Film,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile, Media } from "@/types";

interface Season {
  id: string;
  seasonNumber: number;
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

export default function WatchPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const profileId = params.id as string;
  const mediaId = params.mediaId as string;
  const episodeParam = searchParams.get("episode");

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [media, setMedia] = useState<MediaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Video State
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [centerIcon, setCenterIcon] = useState<"play" | "pause" | "seek-fwd" | "seek-back" | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showEpisodesDrawer, setShowEpisodesDrawer] = useState(false);

  // Hover Seek Bar Tooltip
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  // Next Episode Countdown
  const [showNextCountdown, setShowNextCountdown] = useState(false);
  const [nextCountdownSeconds, setNextCountdownSeconds] = useState(10);

  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const initialSeekDoneRef = useRef(false);

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

  // Restore watch progress on metadata load
  const restoreProgress = useCallback(async () => {
    if (initialSeekDoneRef.current) return;
    try {
      const epQuery = episodeParam ? `?episode=${episodeParam}` : "";
      const res = await fetch(`/api/media/${mediaId}/progress${epQuery}`);
      const data = await res.json();
      if (data.success && data.data && data.data.positionSeconds > 10 && !data.data.completed) {
        const targetPos = data.data.positionSeconds;
        if (videoRef.current) {
          videoRef.current.currentTime = targetPos;
          initialSeekDoneRef.current = true;
          setResumeToast(`Resumed from ${formatTimestamp(targetPos)}`);
          setTimeout(() => setResumeToast(null), 4000);
        }
      }
    } catch {}
  }, [mediaId, episodeParam]);

  // Periodic watch progress saving (every 5 seconds)
  const saveProgress = useCallback(async () => {
    const video = videoRef.current;
    if (!video || isNaN(video.currentTime) || video.currentTime <= 0) return;

    try {
      await fetch(`/api/media/${mediaId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionSeconds: video.currentTime,
          durationSeconds: video.duration || 0,
          episodeId: episodeParam || null,
        }),
      });
    } catch {}
  }, [mediaId, episodeParam]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      saveProgress();
    }, 5000);
    return () => clearInterval(interval);
  }, [playing, saveProgress]);

  // Current Episode computation
  const currentEpisode = media?.episodes?.find((ep) => ep.id === episodeParam) || media?.episodes?.[0];
  const nextEpisode = media?.episodes?.find(
    (ep) =>
      ep.seasonNumber === currentEpisode?.seasonNumber &&
      ep.episodeNumber === (currentEpisode?.episodeNumber ?? 0) + 1
  );

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }

      // Check for next episode countdown when remaining < 15s
      if (media?.type === "series" && nextEpisode && video.duration > 0) {
        const remaining = video.duration - video.currentTime;
        if (remaining <= 15 && remaining > 0.5) {
          setShowNextCountdown(true);
          setNextCountdownSeconds(Math.ceil(remaining));
        } else {
          setShowNextCountdown(false);
        }
      }
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      restoreProgress();
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      if (nextEpisode) {
        router.push(`/profiles/${profileId}/watch/${mediaId}?episode=${nextEpisode.id}`);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [media, nextEpisode, profileId, mediaId, router]);

  // Activity timer for controls auto-hiding
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3500);
  }, []);

  const triggerCenterIcon = (icon: "play" | "pause" | "seek-fwd" | "seek-back") => {
    setCenterIcon(icon);
    setTimeout(() => setCenterIcon(null), 600);
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      triggerCenterIcon("play");
    } else {
      video.pause();
      triggerCenterIcon("pause");
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  const seek = useCallback((offset: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + offset));
    triggerCenterIcon(offset > 0 ? "seek-fwd" : "seek-back");
    resetControlsTimer();
  }, [resetControlsTimer]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const handleVolumeChange = (newVal: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVal;
    setVolume(newVal);
    if (newVal === 0) {
      video.muted = true;
      setMuted(true);
    } else if (muted) {
      video.muted = false;
      setMuted(false);
    }
    resetControlsTimer();
  };

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
    resetControlsTimer();
  }, [resetControlsTimer]);

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {}
    resetControlsTimer();
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (document.activeElement?.tagName === "INPUT") return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seek(-10);
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seek(10);
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case "p":
          e.preventDefault();
          togglePiP();
          break;
        case "?":
          e.preventDefault();
          setShowShortcuts((prev) => !prev);
          break;
        case "escape":
          if (showShortcuts) setShowShortcuts(false);
          if (showSettings) setShowSettings(false);
          if (showEpisodesDrawer) setShowEpisodesDrawer(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, seek, volume, showShortcuts, showSettings, showEpisodesDrawer]);

  const handleProgressBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
    setHoverPosition(e.clientX - rect.left);
  };

  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = percent * duration;
    resetControlsTimer();
  };

  function formatTimestamp(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  if (!media) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center text-white">
        <Film className="mb-4 h-16 w-16 text-neutral-600" />
        <h2 className="text-2xl font-bold">Media Stream Unavailable</h2>
        <Button className="btn-brand mt-6 rounded-xl" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  const streamSrc = `/api/media/${media.id}/stream${episodeParam ? `?episode=${episodeParam}` : ""}`;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={togglePlay}
      className={`relative h-screen w-screen overflow-hidden bg-black select-none ${
        !showControls ? "cursor-none" : "cursor-default"
      }`}
    >
      {/* Resume playback toast indicator */}
      <AnimatePresence>
        {resumeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-50 rounded-full border border-white/20 bg-black/80 px-4 py-1.5 text-xs font-bold text-white shadow-2xl backdrop-blur-md"
          >
            {resumeToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Underlying Video Player */}
      <video
        ref={videoRef}
        src={streamSrc}
        poster={media.backdropUrl || media.posterUrl || undefined}
        className="h-full w-full object-contain"
        playsInline
        preload="auto"
      />

      {/* Center Animated Icon Feedback (Play / Pause / Seek) */}
      <AnimatePresence>
        {centerIcon && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black/60 backdrop-blur-md shadow-2xl ring-2 ring-white/20">
              {centerIcon === "play" && <Play className="h-12 w-12 fill-white text-white ml-1" />}
              {centerIcon === "pause" && <Pause className="h-12 w-12 text-white" />}
              {centerIcon === "seek-fwd" && (
                <div className="flex flex-col items-center">
                  <RotateCw className="h-10 w-10 text-white" />
                  <span className="text-[10px] font-extrabold text-white mt-0.5">+10s</span>
                </div>
              )}
              {centerIcon === "seek-back" && (
                <div className="flex flex-col items-center">
                  <RotateCcw className="h-10 w-10 text-white" />
                  <span className="text-[10px] font-extrabold text-white mt-0.5">-10s</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD Controls Overlay */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/90 via-transparent to-black/80 px-4 sm:px-8 py-6"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              {/* Back & Title */}
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.back()}
                  className="h-11 w-11 rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/25 transition-all"
                >
                  <ArrowLeft className="h-6 w-6" />
                </Button>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-md">
                      {media.title}
                    </h1>
                    {media.type === "series" && currentEpisode && (
                      <span className="rounded bg-purple-600/80 px-2 py-0.5 text-[11px] font-extrabold text-white uppercase">
                        S{currentEpisode.seasonNumber}:E{currentEpisode.episodeNumber}
                      </span>
                    )}
                  </div>
                  {media.type === "series" && currentEpisode?.title && (
                    <p className="text-xs text-neutral-300 drop-shadow">
                      {currentEpisode.title}
                    </p>
                  )}
                </div>
              </div>

              {/* Top Right Badges & Episode Picker */}
              <div className="flex items-center gap-2.5">
                <span className="badge-quality border-white/20 text-neutral-300">
                  4K ULTRA HD
                </span>

                {media.type === "series" && media.episodes && media.episodes.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowEpisodesDrawer(!showEpisodesDrawer)}
                    className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/50 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/15"
                  >
                    <Tv className="h-4 w-4 text-[#e50914]" />
                    <span>Episodes</span>
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => setShowShortcuts(!showShortcuts)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-neutral-300 hover:bg-white/20 hover:text-white backdrop-blur-md"
                  title="Keyboard Shortcuts (?)"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="space-y-3">
              {/* Interactive Scrubber / Seek Bar */}
              <div
                className="group/seeker relative flex h-6 w-full cursor-pointer items-center"
                onMouseMove={handleProgressBarHover}
                onMouseLeave={() => setHoverTime(null)}
                onClick={handleProgressSeek}
              >
                {/* Background Track */}
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/25 transition-all duration-200 group-hover/seeker:h-2.5">
                  {/* Buffer Progress */}
                  <div
                    className="absolute inset-y-0 left-0 bg-white/40"
                    style={{
                      width: duration > 0 ? `${(buffered / duration) * 100}%` : "0%",
                    }}
                  />
                  {/* Current Time Progress */}
                  <div
                    className="absolute inset-y-0 left-0 bg-[#e50914] shadow-[0_0_12px_#ff2a3a]"
                    style={{
                      width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                    }}
                  />
                </div>

                {/* Scrubber Knob */}
                <div
                  className="absolute h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow-lg ring-2 ring-[#e50914] transition-transform duration-150 scale-0 group-hover/seeker:scale-100"
                  style={{
                    left: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                  }}
                />

                {/* Hover Timestamp Tooltip */}
                {hoverTime !== null && (
                  <div
                    className="pointer-events-none absolute bottom-8 -translate-x-1/2 rounded-lg bg-black/90 px-2.5 py-1 text-xs font-bold text-white shadow-xl ring-1 ring-white/20 backdrop-blur-md"
                    style={{ left: `${hoverPosition}px` }}
                  >
                    {formatTimestamp(hoverTime)}
                  </div>
                )}
              </div>

              {/* Lower Control Actions */}
              <div className="flex items-center justify-between">
                {/* Left Side: Playback buttons, Rewind, Volume, Time */}
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Play / Pause */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="h-10 w-10 text-white hover:text-[#e50914] hover:bg-white/10"
                  >
                    {playing ? (
                      <Pause className="h-6 w-6" />
                    ) : (
                      <Play className="h-6 w-6 fill-current" />
                    )}
                  </Button>

                  {/* Rewind 10s */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => seek(-10)}
                    className="h-10 w-10 text-white hover:text-[#e50914] hover:bg-white/10"
                    title="Rewind 10s (Left Arrow)"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>

                  {/* Forward 10s */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => seek(10)}
                    className="h-10 w-10 text-white hover:text-[#e50914] hover:bg-white/10"
                    title="Forward 10s (Right Arrow)"
                  >
                    <RotateCw className="h-5 w-5" />
                  </Button>

                  {/* Volume Control */}
                  <div className="flex items-center gap-2 group/volume">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMute}
                      className="h-10 w-10 text-white hover:text-[#e50914] hover:bg-white/10"
                    >
                      {muted || volume === 0 ? (
                        <VolumeX className="h-5 w-5 text-red-400" />
                      ) : volume < 0.5 ? (
                        <Volume1 className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </Button>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="h-1.5 w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 transition-all duration-200 accent-[#e50914] cursor-pointer"
                    />
                  </div>

                  {/* Time Counter */}
                  <span className="text-xs sm:text-sm font-semibold tabular-nums text-neutral-300">
                    {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
                  </span>
                </div>

                {/* Right Side: Speed, Next Episode, PiP, Fullscreen */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Playback Speed Pill */}
                  <button
                    type="button"
                    onClick={() => {
                      const rates = [0.75, 1, 1.25, 1.5, 2];
                      const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
                      if (videoRef.current) videoRef.current.playbackRate = nextRate;
                      setPlaybackRate(nextRate);
                    }}
                    className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/15 transition-colors"
                  >
                    {playbackRate}x
                  </button>

                  {/* Next Episode Button */}
                  {nextEpisode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/profiles/${profileId}/watch/${mediaId}?episode=${nextEpisode.id}`)
                      }
                      className="gap-1.5 text-xs font-bold text-white hover:bg-white/15"
                    >
                      <FastForward className="h-4 w-4 text-[#e50914]" />
                      <span className="hidden sm:inline">Next Episode</span>
                    </Button>
                  )}

                  {/* Picture-in-Picture */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePiP}
                    className="h-10 w-10 text-white hover:bg-white/10"
                    title="Picture in Picture (P)"
                  >
                    <PictureInPicture className="h-5 w-5" />
                  </Button>

                  {/* Fullscreen */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    className="h-10 w-10 text-white hover:bg-white/10"
                    title="Fullscreen (F)"
                  >
                    {fullscreen ? (
                      <Minimize className="h-5 w-5" />
                    ) : (
                      <Maximize className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Episode Floating Countdown Toast */}
      <AnimatePresence>
        {showNextCountdown && nextEpisode && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="glass-panel absolute bottom-24 right-8 z-50 flex items-center gap-4 rounded-2xl border border-white/20 p-4 shadow-2xl"
          >
            <div>
              <p className="text-xs font-bold text-[#e50914] uppercase tracking-wider">
                Next Episode Playing in {nextCountdownSeconds}s
              </p>
              <p className="text-sm font-semibold text-white">
                {nextEpisode.episodeNumber}. {nextEpisode.title || "Next Episode"}
              </p>
            </div>
            <Button
              className="btn-brand h-9 rounded-xl px-4 text-xs font-bold"
              onClick={() =>
                router.push(`/profiles/${profileId}/watch/${mediaId}?episode=${nextEpisode.id}`)
              }
            >
              Play Now
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Dialog */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-panel absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setShowShortcuts(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl border border-white/15 bg-[#121215] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">Player Shortcuts</h3>
              <div className="space-y-2.5 text-xs">
                {[
                  { key: "Space / K", action: "Play / Pause" },
                  { key: "F", action: "Toggle Fullscreen" },
                  { key: "M", action: "Mute / Unmute" },
                  { key: "Left / Right Arrow", action: "Seek 10 seconds back / forward" },
                  { key: "Up / Down Arrow", action: "Adjust volume" },
                  { key: "P", action: "Picture in Picture" },
                  { key: "?", action: "Toggle this shortcut cheatsheet" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between border-b border-white/5 py-1.5">
                    <span className="font-semibold text-neutral-300">{item.action}</span>
                    <kbd className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button className="btn-brand rounded-xl" onClick={() => setShowShortcuts(false)}>
                  Close
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
