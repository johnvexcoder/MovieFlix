"use client";
import { useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = {
  email: string | null;
  twoFactorEnabled: boolean;
  recoveryCodesRemaining: number;
};
export function AdminSecurityPanel() {
  const [status, setStatus] = useState<Status | null>(null),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [setupToken, setSetupToken] = useState(""),
    [codes, setCodes] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    const r = await fetch("/api/admin/auth/security", { cache: "no-store" });
    const d = await r.json();
    if (d.success) {
      setStatus(d.data);
      setEmail(d.data.email || "");
    }
  }
  useEffect(() => {
    // Initial security status is loaded after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);
  async function act(action: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email, password, code, setupToken }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      if (action === "begin-enable") {
        setSetupToken(d.data.setupToken);
        setMessage("A six-digit code was sent to your email.");
      } else if (action === "confirm-enable") {
        setCodes(d.data.recoveryCodes);
        setSetupToken("");
        setCode("");
        setPassword("");
        setMessage(
          "Two-step verification is enabled. Save the recovery codes now.",
        );
        await load();
      } else {
        setPassword("");
        setMessage("Two-step verification is disabled.");
        await load();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Security update failed");
    } finally {
      setBusy(false);
    }
  }
  async function copyCodes() {
    await navigator.clipboard.writeText(codes.join("\n"));
    setMessage("Recovery codes copied.");
  }
  return (
    <section className="glass-panel min-w-0 rounded-2xl border border-white/10 p-4 shadow-xl sm:rounded-3xl sm:p-6">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-5 w-5 text-cyan-300" />
        <div>
          <h2 className="text-lg font-bold">
            Administrator email & two-step verification
          </h2>
          <p className="text-xs text-slate-400">
            Email codes protect sign-in. Each recovery code works once.
          </p>
        </div>
      </div>
      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
        <div>
          <Label>Recovery email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status?.twoFactorEnabled || !!setupToken}
            className="mt-1.5 h-11"
          />
        </div>
        <div>
          <Label>Current password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-11"
          />
        </div>
      </div>
      {setupToken && (
        <div className="mt-3">
          <Label>Six-digit email code</Label>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1.5 h-11 max-w-xs font-mono tracking-[.2em]"
          />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {status?.twoFactorEnabled ? (
          <Button
            variant="outline"
            disabled={busy || !password}
            onClick={() => act("disable")}
          >
            Disable two-step verification
          </Button>
        ) : setupToken ? (
          <Button
            className="btn-brand"
            disabled={busy || code.length !== 6}
            onClick={() => act("confirm-enable")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Confirm and enable
          </Button>
        ) : (
          <Button
            className="btn-brand"
            disabled={busy || !email || !password}
            onClick={() => act("begin-enable")}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Verify email and enable
          </Button>
        )}{" "}
        {status?.twoFactorEnabled && (
          <span className="self-center text-xs text-emerald-300">
            Enabled · {status.recoveryCodesRemaining} recovery codes remaining
          </span>
        )}
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm text-cyan-200">
          {message}
        </p>
      )}
      {codes.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3">
          <div className="flex justify-between gap-2">
            <b className="text-sm text-amber-200">
              Save these codes in a secure place
            </b>
            <button
              onClick={copyCodes}
              className="text-cyan-300"
              aria-label="Copy recovery codes"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs text-slate-200">
            {codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
