"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, Lock, User, KeyRound, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkAdminSession } from "@/lib/client-auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const authed = await checkAdminSession();
      if (!cancelled) {
        setRestoring(false);
        if (authed) {
          router.replace("/admin-panel");
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
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push("/admin-panel");
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch {
      setError("Failed to connect to admin gateway");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070709] px-4 py-12 select-none">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff06_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {restoring ? (
          <div className="glass-panel flex min-h-[340px] flex-col items-center justify-center gap-4 rounded-3xl p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/30">
              <Loader2 className="h-7 w-7 animate-spin text-[#e50914]" />
            </div>
            <p className="text-sm font-medium text-neutral-400 animate-pulse">
              Verifying admin session…
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/10">
            {/* Header */}
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e50914] to-[#800208] shadow-lg shadow-red-950/60 ring-1 ring-white/20">
                <ShieldCheck className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Admin Console
              </h1>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                MovieFlix Management Gateway
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Administrator Username
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter admin username"
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500 focus:border-[#e50914] focus:ring-[#e50914]/30"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Admin Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500 focus:border-[#e50914] focus:ring-[#e50914]/30"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs font-medium text-red-300 text-center"
                >
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="btn-brand mt-2 h-12 w-full text-sm font-bold tracking-wide"
                disabled={loading || !username.trim() || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Enter Command Panel
                  </>
                )}
              </Button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
