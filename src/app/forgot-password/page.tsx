"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MovieFlixLogo } from "@/components/movieflix-logo";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
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
            <h1 className="text-2xl font-black tracking-tight text-white">Forgot Password</h1>
            <p className="mt-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              Reset your account password
            </p>
          </div>

          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <CheckCircle className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="text-sm text-neutral-300">
                If that account exists, a password reset link has been sent to its registered email. The link is valid
                for 1 hour.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Username or Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username or email"
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 text-center font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="btn-brand mt-2 h-12 w-full text-base font-bold tracking-wide"
                disabled={loading || !username.trim()}
              >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Mail className="mr-2 h-5 w-5" />}
                Send Reset Link
              </Button>
            </form>
          )}

          <Link href="/login" className="mt-6 flex items-center justify-center text-xs text-neutral-400 hover:text-white">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
