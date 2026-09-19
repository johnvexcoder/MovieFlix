"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Form() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [state, setState] = useState<"loading" | "ready" | "done" | "error" | "used" | "expired">("loading");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function validate() {
    if (!token) return setState("error");
    try {
      const r = await fetch(`/api/admin/auth/invite?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const d = await r.json();
      if (r.status === 410) {
        setState(d.error === "expired" ? "expired" : "used");
        return;
      }
      if (!d.success) { setState("error"); return; }
      setUsername(d.data.username);
      setEmail(d.data.email);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void validate();
  }, [token]);

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/auth/invite/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setState("done");
      setMessage(d.message);
      setTimeout(() => router.replace("/admin-panel/login"), 1600);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not activate account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="cinematic-bg flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-[#0b1629]/95 p-6 shadow-2xl sm:p-9">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10">
          <ShieldCheck className="h-7 w-7 text-cyan-300" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black">Set up admin account</h1>

        {state === "loading" && (
          <div className="mt-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>
        )}

        {state === "error" && (
          <p className="mt-6 rounded-xl border border-red-400/30 bg-red-950/40 p-4 text-center text-sm text-red-200">
            This administrator invitation is invalid or has expired. Contact the Main Admin to request a new invitation.
          </p>
        )}

        {state === "expired" && (
          <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-950/40 p-4 text-center text-sm text-amber-200">
            This administrator invitation has expired. Contact the Main Admin to request a new invitation.
          </p>
        )}

        {state === "used" && (
          <div className="mt-6 text-center">
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-200">
              This invitation link has already been used.
            </p>
            <Link href="/admin-panel/login" className="mt-4 inline-block rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950">
              Go to Admin Login
            </Link>
          </div>
        )}

        {state === "done" && (
          <p className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-center text-sm text-emerald-300">
            {message || "Your administrator account is ready. Please sign in."}
          </p>
        )}

        {state === "ready" && (
          <>
            <p className="mt-2 text-center text-sm text-slate-400">Create the password for your new administrator account.</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-bold text-white">{username}</p>
              <p className="text-xs text-slate-400">{email}</p>
            </div>
            <form onSubmit={activate} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="pwd">New password</Label>
                <div className="relative">
                  <Input id="pwd" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required className="mt-1.5 h-12 border-white/15 bg-white/5 pr-12" />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label="Show password" className="absolute inset-y-0 right-0 mt-1.5 flex w-12 items-center justify-center text-slate-400">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                </div>
                <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
              </div>
              <div>
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required className="mt-1.5 h-12 border-white/15 bg-white/5" />
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
              <Button disabled={busy || password.length < 8 || password !== confirm} className="btn-brand h-12 w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Activate Admin Account
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

export default function SetupAccountPage() {
  return <Suspense fallback={<div className="cinematic-bg flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-cyan-300" /></div>}><Form /></Suspense>;
}