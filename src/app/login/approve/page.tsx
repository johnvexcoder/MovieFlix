"use client";

import { useCallback, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Lock, ShieldCheck, Smartphone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MovieFlixLogo } from "@/components/movieflix-logo";
import { checkUserSession } from "@/lib/client-auth";
import { TV_CODE_RE } from "@/lib/tv-code";

type Phase = "checking" | "login" | "approving" | "approved" | "error";

function ApproveInner() {
  const params = useSearchParams();
  const tvCode = String(params.get("tv_code") || "").toUpperCase();

  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const approve = useCallback(async () => {
    setPhase("approving");
    setError(null);
    try {
      const res = await fetch("/api/auth/tv/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: tvCode }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setPhase("approved");
      } else {
        setError(data?.error || "Could not approve this TV login code.");
        setPhase("error");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setPhase("error");
    }
  }, [tvCode]);

  useEffect(() => {
    if (!TV_CODE_RE.test(tvCode)) {
      const id = window.setTimeout(() => {
        setError("This link is invalid or missing a TV login code.");
        setPhase("error");
      }, 0);
      return () => window.clearTimeout(id);
    }
    let cancelled = false;
    (async () => {
      const authed = await checkUserSession();
      if (cancelled) return;
      if (authed) {
        await approve();
      } else {
        setPhase("login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tvCode, approve]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/account-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data?.success) {
        if (data.data?.requiresPayment) {
          setError("This account still needs to complete sign-up payment. Please finish registration first.");
          setPhase("error");
          return;
        }
        await approve();
      } else {
        setError(data?.error || "Invalid username or password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to media server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cinematic-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 select-none">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/15 blur-[160px]" />
        <div className="absolute -bottom-10 right-1/4 h-[400px] w-[500px] rounded-full bg-fuchsia-600/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-panel relative rounded-3xl p-8 shadow-2xl shadow-black/80">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 p-2 shadow-2xl ring-1 ring-white/10">
              <MovieFlixLogo className="h-12 w-12" size={48} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Approve TV Sign-In
            </h1>
            <p className="mt-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              {TV_CODE_RE.test(tvCode) ? `Code ${tvCode}` : "Code required"}
            </p>
          </div>

          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <Smartphone className="h-8 w-8 flex-shrink-0 text-[var(--brand)]" />
            <p className="text-sm text-neutral-300">
              A Smart TV is asking to sign in. Approve it from this phone to open MovieFlix on your TV.
            </p>
          </div>

          {phase === "checking" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--brand)]" />
              <p className="text-sm text-neutral-400">Checking your session…</p>
            </div>
          )}

          {phase === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="approve-username" className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Account Username
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    id="approve-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="Enter username"
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500"
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="approve-password" className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    id="approve-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-neutral-500"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-center text-xs font-medium text-red-300"
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
                  "Sign In & Approve TV"
                )}
              </Button>
            </form>
          )}

          {phase === "approving" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
              <p className="text-sm text-neutral-400">Approving your TV…</p>
            </div>
          )}

          {phase === "approved" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className="text-base font-bold text-white">Approved!</p>
              <p className="text-sm text-neutral-400">
                Go back to your TV — it will sign you in within a few seconds.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-base font-bold text-white">Couldn&apos;t approve</p>
              <p className="text-sm text-neutral-400">{error}</p>
              <Button variant="outline" className="mt-1 rounded-xl border-white/10" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-neutral-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Protected Private Node</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function TvLoginApprovePage() {
  return (
    <Suspense
      fallback={
        <div className="cinematic-bg flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)]" />
        </div>
      }
    >
      <ApproveInner />
    </Suspense>
  );
}