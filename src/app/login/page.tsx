"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lock, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MovieFlixLogo } from "@/components/movieflix-logo";
import { checkUserSession } from "@/lib/client-auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const authed = await checkUserSession();
      if (!cancelled) {
        setRestoring(false);
        if (authed) {
          router.replace("/profiles");
        }
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/account-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push("/profiles");
      } else {
        setError(data.error || "Invalid username or password");
      }
    } catch {
      setError("Failed to connect to media server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070709] px-4 py-12 select-none">
      {/* Dynamic Cinematic Ambient Backdrops */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/15 blur-[160px]" />
        <div className="absolute -bottom-10 right-1/4 h-[400px] w-[500px] rounded-full bg-purple-900/15 blur-[140px]" />
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
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/30">
              <Loader2 className="h-7 w-7 animate-spin text-[#e50914]" />
              <div className="absolute inset-0 rounded-2xl animate-ping bg-red-500/10" />
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
                Movie<span className="text-[#e50914]">Flix</span>
              </h1>
              <p className="mt-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
                Sign In to Watch
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Account Username
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500 focus:border-[#e50914] focus:ring-[#e50914]/30"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500 focus:border-[#e50914] focus:ring-[#e50914]/30"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 text-center font-medium"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="btn-brand mt-2 h-12 w-full text-base font-bold tracking-wide"
                disabled={loading || !username.trim() || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </form>

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
