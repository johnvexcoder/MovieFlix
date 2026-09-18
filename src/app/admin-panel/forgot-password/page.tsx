"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Method = "pick" | "email" | "code";

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("pick");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      router.push(`/admin-panel/reset-password?identifier=${encodeURIComponent(identifier.trim())}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send recovery instructions");
    } finally {
      setLoading(false);
    }
  }

  function continueWithCode() {
    if (!identifier.trim()) return setError("Enter your administrator username or email to continue.");
    router.push(`/admin-panel/reset-password?identifier=${encodeURIComponent(identifier.trim())}`);
  }

  return (
    <main className="cinematic-bg flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-[#0b1629]/95 p-6 shadow-2xl sm:p-9">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10">
          <ShieldCheck className="h-7 w-7 text-cyan-300" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black">Recover admin account</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          {method === "pick"
            ? "Choose how you want to regain access to the administrator account."
            : "We’ll verify your identity securely before allowing a password reset."}
        </p>

        {method === "pick" && (
          <div className="mt-7 grid gap-3">
            <button
              type="button"
              onClick={() => { setMethod("email"); setError(""); }}
              className="flex min-h-[64px] items-start gap-3 rounded-2xl border border-white/12 bg-white/5 p-4 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-300">
                <Mail className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <b className="block text-sm">Recover via Email</b>
                <small className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                  A six-digit code and a secure reset link are sent to the administrator recovery email.
                </small>
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setMethod("code"); setError(""); }}
              className="flex min-h-[64px] items-start gap-3 rounded-2xl border border-white/12 bg-white/5 p-4 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
                <KeyRound className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <b className="block text-sm">Recover via Recovery Code</b>
                <small className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                  Use one of the ten one-time recovery codes saved when two-step verification was enabled.
                </small>
              </span>
            </button>
          </div>
        )}

        {method !== "pick" && (
          <form
            onSubmit={method === "email" ? submitEmail : (e) => { e.preventDefault(); continueWithCode(); }}
            className="mt-7 space-y-4"
          >
            <div>
              <Label htmlFor="identifier">Administrator username or email</Label>
              <Input
                id="identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value.toLowerCase())}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                autoFocus
                className="mt-1.5 h-12 border-white/15 bg-white/5"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">
                {error}
              </p>
            )}
            <Button
              disabled={loading || !identifier.trim()}
              className="btn-brand h-12 w-full"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : method === "email" ? (
                <Mail className="mr-2 h-4 w-4" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              {method === "email" ? "Send recovery instructions" : "Continue with a recovery code"}
            </Button>
            <button
              type="button"
              onClick={() => { setMethod("pick"); setError(""); }}
              className="block min-h-11 w-full py-3 text-center text-sm text-slate-400 hover:text-cyan-300"
            >
              ← Back to recovery options
            </button>
          </form>
        )}

        <Link
          href="/admin-panel/login"
          className="mt-4 block min-h-11 py-3 text-center text-sm text-cyan-300 hover:underline"
        >
          Return to admin sign in
        </Link>
      </section>
    </main>
  );
}