"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Lock, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Account username/password sign-in form. Shared by the desktop /login page
 * and the Smart TV /tv/login page (which pairs it with a QR code), so the form
 * stays pixel-identical everywhere it appears.
 */
export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        setError(`Server error (${response.status}): ${text.slice(0, 120)}`);
        return;
      }

      if (data.success) {
        if (data.data?.requiresPayment && data.data?.signupToken) {
          sessionStorage.setItem("movieflix_signup_token", data.data.signupToken);
          router.push("/register/payment");
        } else router.push("/profiles");
      } else {
        setError(data.error || "Invalid username or password");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to media server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label
            htmlFor="username"
            className="text-xs font-semibold uppercase tracking-wider text-neutral-300 tv:text-lg"
          >
            Account Username
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500 tv:left-5 tv:h-6 tv:w-6" />
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="Enter username"
              className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500 focus:border-[var(--brand)] focus:ring-[var(--brand)]/30 tv:h-16 tv:rounded-2xl tv:pl-14 tv:text-xl"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-neutral-300 tv:text-lg"
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-neutral-400 transition-colors hover:text-[var(--brand)] tv:text-lg"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-500 tv:left-5 tv:h-6 tv:w-6" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="current-password"
              className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-neutral-500 focus:border-[var(--brand)] focus:ring-[var(--brand)]/30 tv:h-16 tv:rounded-2xl tv:pl-14 tv:pr-14 tv:text-xl"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute top-1/2 right-3.5 -translate-y-1/2 p-1 text-neutral-400 transition-colors hover:text-neutral-200 tv:right-5"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4 tv:h-6 tv:w-6" /> : <Eye className="h-4 w-4 tv:h-6 tv:w-6" />}
            </button>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-center text-xs font-medium text-red-300 tv:text-base"
          >
            {error}
          </motion.div>
        )}

        <Button
          type="submit"
          className="btn-brand mt-2 h-12 w-full text-base font-bold tracking-wide tv:h-16 tv:text-2xl"
          disabled={loading || !username.trim() || !password.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin tv:h-7 tv:w-7" />
              Signing in…
            </>
          ) : (
            "Login"
          )}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <Link
          href="/register"
          className="text-sm font-semibold text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline tv:text-lg"
        >
          New to MovieFlix? Register here
        </Link>
      </div>
    </>
  );
}