"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, Lock, User, KeyRound, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

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

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setError(`Server error (${response.status}): ${text.slice(0, 120)}`);
        return;
      }

      if (data.success && data.data?.requiresTwoFactor) {
        setChallengeToken(data.data.challengeToken);
        setMaskedEmail(data.data.maskedEmail);
        setVerificationCode("");
      } else if (data.success) {
        router.push("/admin-panel");
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to admin gateway");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerification(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const response = await fetch("/api/admin/auth/verify-2fa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeToken, code: verificationCode }) });
      const data = await response.json();
      if (data.success) router.push("/admin-panel"); else setError(data.error || "Verification failed");
    } catch { setError("Could not verify the code"); } finally { setLoading(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070709] px-4 py-12 select-none">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[150px]" />
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-400/30">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--brand)]" />
            </div>
            <p className="text-sm font-medium text-neutral-400 animate-pulse">
              Verifying admin session…
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/10">
            {/* Header */}
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[#800208] shadow-lg shadow-red-950/60 ring-1 ring-white/20">
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
            {challengeToken ? <form onSubmit={handleVerification} className="space-y-4">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-center text-sm text-slate-300">Enter the six-digit code sent to <b className="text-cyan-200">{maskedEmail}</b>, or use one unused recovery code.</div>
              <div><Label htmlFor="verification-code" className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Verification or recovery code</Label><Input id="verification-code" value={verificationCode} onChange={(e)=>setVerificationCode(e.target.value.toUpperCase())} inputMode="numeric" autoComplete="one-time-code" autoFocus className="mt-1.5 h-12 rounded-xl border-white/10 bg-white/5 text-center font-mono text-xl tracking-[.25em] text-white" required /></div>
              {error&&<div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-center text-xs text-red-300">{error}</div>}
              <Button type="submit" className="btn-brand h-12 w-full" disabled={loading||verificationCode.trim().length<6}>{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<KeyRound className="h-4 w-4"/>} Verify administrator</Button>
              <button type="button" onClick={()=>{setChallengeToken("");setVerificationCode("");setError(null)}} className="w-full text-sm text-slate-400 hover:text-white">Back to password</button>
            </form> : <form onSubmit={handleLogin} className="space-y-4">
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
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500 focus:border-[var(--brand)] focus:ring-[var(--brand)]/30"
                    autoFocus
                    required
                  />
                </div>
              </div>

                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter admin password"
                      className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-neutral-500 focus:border-[var(--brand)] focus:ring-[var(--brand)]/30"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 right-3.5 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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
            </form>}
          </div>
        )}
      </motion.div>
    </div>
  );
}
