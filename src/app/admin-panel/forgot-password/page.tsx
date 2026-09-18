"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Method = "pick" | "email" | "code" | "assistant";

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("pick");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Admin Assistant flow
  const [assistantCode, setAssistantCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

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

  async function sendAssistantRequest(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/admin-assistant/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setRequestSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request a recovery code");
    } finally {
      setLoading(false);
    }
  }

  async function submitAssistantReset(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/admin-assistant/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code: assistantCode.trim(), newPassword }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      router.push("/admin-panel/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  const methodMeta: Record<string, { icon: typeof Mail; tone: string; label: string; hint: string }> = {
    email: {
      icon: Mail,
      tone: "bg-cyan-300/15 text-cyan-300",
      label: "Recover via Email",
      hint: "A six-digit code and a secure reset link are sent to the administrator recovery email.",
    },
    code: {
      icon: KeyRound,
      tone: "bg-fuchsia-500/15 text-fuchsia-300",
      label: "Recover via Recovery Code",
      hint: "Use one of the ten one-time recovery codes saved when two-step verification was enabled.",
    },
    assistant: {
      icon: MessageSquare,
      tone: "bg-emerald-500/15 text-emerald-300",
      label: "Recover through Admin Assistant",
      hint: "Send a 6-digit code request to the Main Admin via Telegram.",
    },
  };

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
            : method === "assistant"
              ? "Send a 6-digit code request to the Main Admin."
              : "We’ll verify your identity securely before allowing a password reset."}
        </p>

        {method === "pick" && (
          <div className="mt-7 grid gap-3">
            {(["email", "code", "assistant"] as Method[]).map((m) => {
              const meta = methodMeta[m];
              const Icon = meta.icon;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMethod(m); setError(""); }}
                  className="flex min-h-[64px] items-start gap-3 rounded-2xl border border-white/12 bg-white/5 p-4 text-left transition hover:border-cyan-300/40 hover:bg-white/10"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-sm">{meta.label}</b>
                    <small className="mt-0.5 block text-xs leading-relaxed text-slate-400">{meta.hint}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {method === "email" && (
          <form onSubmit={submitEmail} className="mt-7 space-y-4">
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
            {error && <ErrorBanner message={error} />}
            <Button disabled={loading || !identifier.trim()} className="btn-brand h-12 w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send recovery instructions
            </Button>
          </form>
        )}

        {method === "code" && (
          <form onSubmit={(e) => { e.preventDefault(); continueWithCode(); }} className="mt-7 space-y-4">
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
            {error && <ErrorBanner message={error} />}
            <Button disabled={loading || !identifier.trim()} className="btn-brand h-12 w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Continue with a recovery code
            </Button>
          </form>
        )}

        {method === "assistant" && !requestSent && (
          <form onSubmit={sendAssistantRequest} className="mt-7 space-y-4">
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
            {error && <ErrorBanner message={error} />}
            <Button disabled={loading || !identifier.trim()} className="btn-brand h-12 w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
              Send 6 digit code to Main Admin
            </Button>
          </form>
        )}

        {method === "assistant" && requestSent && (
          <form onSubmit={submitAssistantReset} className="mt-7 space-y-4">
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300">
              A 6-digit recovery code was requested. Ask the Main Admin for the code, then set a new password.
            </p>
            <div>
              <Label htmlFor="assistant-code">6-digit recovery code</Label>
              <Input
                id="assistant-code"
                inputMode="numeric"
                value={assistantCode}
                onChange={(event) => setAssistantCode(event.target.value)}
                autoComplete="one-time-code"
                required
                maxLength={6}
                className="mt-1.5 h-12 border-white/15 bg-white/5 font-mono tracking-[.2em]"
                placeholder="••••••"
              />
            </div>
            <div>
              <Label htmlFor="assistant-password">New password</Label>
              <div className="relative">
                <Input
                  id="assistant-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="mt-1.5 h-12 border-white/15 bg-white/5 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 mt-1.5 flex w-12 items-center justify-center text-slate-400"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="assistant-confirm">Confirm new password</Label>
              <Input
                id="assistant-confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-1.5 h-12 border-white/15 bg-white/5"
              />
            </div>
            {error && <ErrorBanner message={error} />}
            <Button
              disabled={loading || assistantCode.length !== 6 || newPassword.length < 8 || newPassword !== confirmPassword}
              className="btn-brand h-12 w-full"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Reset administrator password
            </Button>
            <button
              type="button"
              onClick={() => { setRequestSent(false); setAssistantCode(""); setNewPassword(""); setConfirmPassword(""); setError(""); }}
              className="block min-h-11 w-full py-3 text-center text-sm text-slate-400 hover:text-cyan-300"
            >
              ← Request a new code
            </button>
          </form>
        )}

        {method !== "pick" && (
          <button
            type="button"
            onClick={() => { setMethod("pick"); setError(""); setRequestSent(false); }}
            className="mt-4 block min-h-11 w-full py-3 text-center text-sm text-slate-400 hover:text-cyan-300"
          >
            ← Back to recovery options
          </button>
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

function ErrorBanner({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">
      {message}
    </p>
  );
}