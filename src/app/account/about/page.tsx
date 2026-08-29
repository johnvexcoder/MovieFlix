"use client";

import { Info, Film, Shield, Clock, Sparkles } from "lucide-react";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { MovieFlixLogo } from "@/components/movieflix-logo";

export default function AboutPage() {
  return (
    <AccountSettingsShell heading="About MovieFlix" subheading="A private streaming platform for movies and TV series.">
      <div className="space-y-5">
        <div className="glass-panel rounded-3xl border border-white/10 p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 p-2 ring-1 ring-white/10">
              <MovieFlixLogo className="h-12 w-12" size={48} />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight text-white">
                Movie<span className="text-[#e50914]">Flix</span>
              </p>
              <p className="text-xs font-semibold tracking-wider text-neutral-400 uppercase">Private Streaming Platform</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-neutral-300">
            MovieFlix is a private, self-hosted streaming platform that lets you watch your favorite movies and TV
            series anywhere. Built with a focus on performance, security, and a familiar streaming experience.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass-panel rounded-3xl border border-white/10 p-5">
            <Film className="h-5 w-5 text-[#e50914]" />
            <h3 className="mt-2.5 text-sm font-bold text-white">Your Library, Instantly</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Movies and series are scanned from your storage and served with adaptive quality, local subtitles, and
              resume support.
            </p>
          </div>
          <div className="glass-panel rounded-3xl border border-white/10 p-5">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h3 className="mt-2.5 text-sm font-bold text-white">Private & Secure</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Access is restricted to invited accounts only. Sessions are short-lived, tokens rotate, and lockouts take
              effect immediately.
            </p>
          </div>
          <div className="glass-panel rounded-3xl border border-white/10 p-5">
            <Clock className="h-5 w-5 text-amber-400" />
            <h3 className="mt-2.5 text-sm font-bold text-white">Never Miss a Beat</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Pick up exactly where you left off across devices, with watch history and per-profile progress.
            </p>
          </div>
          <div className="glass-panel rounded-3xl border border-white/10 p-5">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <h3 className="mt-2.5 text-sm font-bold text-white">Built for the Fans</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Suggestions, feedback, and reports from subscribers help shape every update.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-xs text-neutral-500">
          <div className="flex items-center justify-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>MovieFlix Platform · Self-hosted media streaming</span>
          </div>
          <p className="mt-1">
            For support, use the <span className="font-semibold text-neutral-300">Report a Problem</span> option in your
            account menu.
          </p>
        </div>
      </div>
    </AccountSettingsShell>
  );
}