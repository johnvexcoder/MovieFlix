"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { MovieFlixLogo } from "@/components/movieflix-logo";
import { LoginForm } from "@/components/auth/login-form";
import { checkUserSession } from "@/lib/client-auth";
import { useTvMode } from "@/hooks/use-tv-mode";

export default function LoginPage() {
  const router = useRouter();
  const isTv = useTvMode();
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const authed = await checkUserSession();
      if (!cancelled) {
        if (authed) {
          router.replace("/profiles");
        } else if (isTv) {
          // Smart TVs get the QR sign-in experience.
          router.replace("/tv/login");
        } else {
          setRestoring(false);
        }
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, [router, isTv]);

  return (
    <div className="cinematic-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 select-none">
      {/* Dynamic Cinematic Ambient Backdrops */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/15 blur-[160px]" />
        <div className="absolute -bottom-10 right-1/4 h-[400px] w-[500px] rounded-full bg-fuchsia-600/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {restoring ? (
          <div className="glass-panel flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-3xl p-8">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-500/30">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--brand)]" />
              <div className="absolute inset-0 rounded-2xl animate-ping bg-cyan-500/10" />
            </div>
            <p className="text-sm font-medium tracking-wide text-neutral-400 animate-pulse">
              Connecting to secure session…
            </p>
          </div>
        ) : (
          <div className="glass-panel relative rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/80">
            {/* Header / Brand Icon */}
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 p-2 shadow-2xl ring-1 ring-white/10">
                <MovieFlixLogo className="h-12 w-12" size={48} />
              </div>

              <h1 className="text-3xl font-black tracking-tight text-white">
                Movie<span className="text-[var(--brand)]">Flix</span>
              </h1>
              <p className="mt-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
                Sign In to Watch
              </p>
            </div>

            {/* Login Form (shared with /tv/login) */}
            <LoginForm />

            {/* Bottom Footer Info */}
            <div className="mt-8 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-center text-xs text-neutral-500">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Protected Private Node</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
