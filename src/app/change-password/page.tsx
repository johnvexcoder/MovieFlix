"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lock, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MovieFlixLogo } from "@/components/movieflix-logo";
import { checkUserSession } from "@/lib/client-auth";

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const required = searchParams.get("required") === "1";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function gate() {
      const authed = await checkUserSession();
      if (!cancelled) {
        setChecking(false);
        if (!authed) {
          router.replace("/login");
        }
      }
    }
    gate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (next.length < 6) {
      setMessage({ ok: false, text: "New password must be at least 6 characters." });
      setLoading(false);
      return;
    }
    if (next !== confirm) {
      setMessage({ ok: false, text: "New passwords do not match." });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({
          ok: true,
          text: "Password updated successfully.",
        });
        setTimeout(() => router.replace("/profiles"), 1200);
      } else {
        setMessage({ ok: false, text: data.error || "Failed to update password" });
      }
    } catch {
      setMessage({ ok: false, text: "Failed to connect. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709]">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070709] px-4 py-12 select-none">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-[400px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
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
            <h1 className="text-2xl font-black tracking-tight text-white">
              {required ? "Set a New Password" : "Change Password"}
            </h1>
            <p className="mt-1 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
              {required
                ? "For your security, please set a new password before continuing"
                : "Update your account password"}
            </p>
          </div>

          {required && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 p-3 text-xs text-amber-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>You must set a new password before you can use your account.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Current Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder={required ? "Enter temporary password" : "Enter current password"}
                  className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500"
                  required
                />
              </div>
            </div>

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

            {message && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border p-3 text-xs text-center font-medium ${
                  message.ok
                    ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                    : "border-red-500/30 bg-red-950/40 text-red-300"
                }`}
              >
                {message.text}
              </motion.div>
            )}

            <Button
              type="submit"
              className="btn-brand mt-2 h-12 w-full text-base font-bold tracking-wide"
              disabled={loading || next.length < 6 || next !== confirm}
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Lock className="mr-2 h-5 w-5" />}
              {required ? "Set Password & Continue" : "Update Password"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070709]">
          <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
        </div>
      }
    >
      <ChangePasswordForm />
    </Suspense>
  );
}
