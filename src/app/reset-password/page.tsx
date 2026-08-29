"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, KeyRound, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MovieFlixLogo } from "@/components/movieflix-logo";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noToken] = useState(!token);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      setLoading(false);
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: next }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setTimeout(() => router.replace("/login"), 1500);
      } else {
        setError(data.error || "Failed to reset password.");
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070709] px-4 py-12 select-none">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-[400px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[160px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-panel rounded-3xl p-8 shadow-2xl shadow-black/80">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 ring-1 ring-white/10">
              <MovieFlixLogo className="h-12 w-12" size={48} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Set New Password</h1>
            <p className="mt-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              Choose a new password for your account
            </p>
          </div>

          {noToken ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
                <AlertCircle className="h-7 w-7 text-red-400" />
              </div>
              <p className="text-sm text-neutral-300">
                This reset link is invalid or incomplete. Please request a new one.
              </p>
              <Button onClick={() => router.replace("/forgot-password")} className="btn-brand mt-6 h-11 w-full rounded-xl text-sm font-bold">
                Request New Link
              </Button>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-sm text-neutral-300">Your password has been reset. Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">New Password</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type="password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  className="h-12 rounded-xl border-white/10 bg-white/5 pl-4 text-white placeholder:text-neutral-500"
                  required
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 text-center font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="btn-brand mt-2 h-12 w-full text-base font-bold tracking-wide"
                disabled={loading || next.length < 6 || next !== confirm}
              >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <KeyRound className="mr-2 h-5 w-5" />}
                Reset Password
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070709]">
          <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
