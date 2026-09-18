"use client";
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminEmailChange() {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function requestChange(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/email/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setStep("verify");
      setMessage({ ok: true, text: d.message });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not start email change" });
    } finally {
      setBusy(false);
    }
  }

  async function verifyChange(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/email/change", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setMessage({ ok: true, text: d.message });
      setStep("form");
      setNewEmail("");
      setCurrentPassword("");
      setCode("");
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not verify email change" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass-panel min-w-0 rounded-2xl border border-white/10 p-4 shadow-xl sm:rounded-3xl sm:p-6">
      <div className="flex items-center gap-2.5">
        <Mail className="h-5 w-5 text-cyan-300" />
        <div>
          <h2 className="text-lg font-bold">Change administrator email</h2>
          <p className="text-xs text-slate-400">
            Verify your current password, then confirm a code sent to the new address.
          </p>
        </div>
      </div>

      {step === "form" ? (
        <form onSubmit={requestChange} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <div>
            <Label>New administrator email</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label>Current password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-1.5 h-11"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="btn-brand" disabled={busy || !newEmail || !currentPassword}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
              Send verification code
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={verifyChange} className="mt-4 space-y-3">
          <div>
            <Label>6-digit verification code</Label>
            <Input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="mt-1.5 h-11 max-w-xs font-mono tracking-[.2em]"
              placeholder="••••••"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="btn-brand" disabled={busy || code.length !== 6}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
              Confirm new email
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("form")}
              disabled={busy}
            >
              Back
            </Button>
          </div>
        </form>
      )}

      {message && (
        <p
          className={`mt-3 rounded-xl border p-3 text-sm font-semibold ${
            message.ok
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
              : "border-red-400/30 bg-red-950/40 text-red-200"
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}