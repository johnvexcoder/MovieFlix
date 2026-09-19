"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { AdminPage, AdminSection } from "@/components/admin/admin-page";
import { SettingRow, SettingsGroup } from "@/components/admin/settings/setting-row";
import { AboutTeamManager } from "@/components/admin/about-team-manager";
import { AdminAuditLog } from "@/components/admin/admin-audit-log";
import { AdminRecoveryOnboarding } from "@/components/admin/admin-recovery-onboarding";
import { AdminEmailChange } from "@/components/admin/admin-email-change";
import { AdminSecurityPanel } from "@/components/admin/admin-security-panel";
import { TelegramSettings } from "@/components/admin/telegram-settings";
import { SmtpSettings } from "@/components/admin/smtp-settings";
import { AdminRosterManager } from "@/components/admin/admin-roster-manager";

type Section = "account" | "security" | "communication";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "account", label: "Admin Account" },
  { id: "security", label: "Security & Recovery" },
  { id: "communication", label: "Communication" },
];

interface Me {
  id: string;
  username: string;
  email: string | null;
}
interface SecurityStatus {
  email: string | null;
  twoFactorEnabled: boolean;
  recoveryCodesRemaining: number;
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "Not configured";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setMsg({ ok: false, text: "New passwords do not match." });
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setCurrent(""); setNext(""); setConfirm("");
      setMsg({ ok: true, text: "Password updated." });
      onClose();
    } catch (e2) {
      setMsg({ ok: false, text: e2 instanceof Error ? e2.message : "Failed to change password" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Change password</DialogTitle>
          <DialogDescription className="text-neutral-400">Use a password of at least 8 characters.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Current password</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">New password</Label>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" minLength={8} required />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Confirm new</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" minLength={8} required />
            </div>
          </div>
          {msg && <p className={`rounded-xl border p-3 text-xs font-semibold ${msg.ok ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400" : "border-red-500/30 bg-red-950/40 text-red-400"}`}>{msg.text}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-xl border-white/10" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy} className="btn-brand rounded-xl">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />} Change password</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const section = (params.get("section") as Section) || "account";

  const [me, setMe] = useState<Me | null>(null);
  const [security, setSecurity] = useState<SecurityStatus | null>(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [smtpOpen, setSmtpOpen] = useState(false);

  const setSection = useCallback((s: Section) => router.replace(`/admin-panel/settings?section=${s}`), [router]);

  useEffect(() => {
    fetch("/api/admin/auth/me").then((r) => r.json()).then((d) => { if (d.success) setMe(d.data); }).catch(() => {});
    fetch("/api/admin/auth/security", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d.success) setSecurity(d.data); }).catch(() => {});
  }, []);

  const recoveryComplete = security?.email && security.twoFactorEnabled && security.recoveryCodesRemaining > 0;

  return (
    <AdminPage
      title="System Settings"
      description="Identity and Administration — manage administrator identity, security, recovery, sessions, and communication."
    >
      {/* Tab selector */}
      <div role="tablist" aria-label="System settings groups" className="mb-6 grid grid-cols-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-bold transition ${
              section === s.id ? "bg-[var(--brand)] text-slate-950" : "text-neutral-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "account" && (
        <AdminSection>
          <SettingsGroup title="Admin Account" description="Your identity, email, password, sessions, and administrators.">
            <SettingRow title="Administrator" description="Current active session" value={<span className="font-semibold">{me?.username || "…"}</span>} />
            <SettingRow title="Email" description="Used for admin login and recovery." value={maskEmail(me?.email)} action={<Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold" onClick={() => setEmailOpen(true)}><Mail className="mr-1.5 h-4 w-4" /> Change</Button>} />
            <SettingRow title="Password" description="Your login password." value="••••••••" action={<Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold" onClick={() => setPasswordOpen(true)}><Lock className="mr-1.5 h-4 w-4" /> Change</Button>} />
          </SettingsGroup>
          <AdminRosterManager selfId={me?.id} />
        </AdminSection>
      )}

      {section === "security" && (
        <AdminSection>
          <AdminRecoveryOnboarding />
          <SettingsGroup title="Security & Recovery" description="Recovery email, two-step verification, recovery codes, and Admin Assistant.">
            <SettingRow title="Recovery email" description="Used to reset your password." value={maskEmail(security?.email)} action={<Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold" onClick={() => setEmailOpen(true)}><Mail className="mr-1.5 h-4 w-4" /> Manage</Button>} />
            <SettingRow title="Two-step verification" description="Email codes protect sign-in." value={security?.twoFactorEnabled ? <span className="text-emerald-400">Enabled</span> : <span className="text-neutral-400">Disabled</span>} action={<Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold" onClick={() => setSecurityOpen(true)}><ShieldCheck className="mr-1.5 h-4 w-4" /> Configure</Button>} />
            <SettingRow title="Recovery codes" description="One-time codes for account recovery." value={<span>{security?.recoveryCodesRemaining ?? 0} of 10 remaining</span>} action={<Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold" onClick={() => setSecurityOpen(true)}><ShieldCheck className="mr-1.5 h-4 w-4" /> Manage</Button>} />
            <SettingRow title="Admin Assistant" description="Telegram recovery to the Main Admin." value={security?.email ? <span className="text-emerald-400">Configured</span> : <span className="text-neutral-400">Not configured</span>} action={<Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold" onClick={() => setTelegramOpen(true)}>Configure</Button>} />
          </SettingsGroup>
          {!recoveryComplete && (
            <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs font-semibold text-amber-200">
              Complete your recovery setup to protect against lockout — set a recovery email, enable two-step verification, and generate recovery codes.
            </p>
          )}
        </AdminSection>
      )}

      {section === "communication" && (
        <AdminSection>
          <SettingsGroup title="Communication" description="Email delivery (SMTP) configuration.">
            <SettingRow title="SMTP email delivery" description="Outgoing mail for recovery, reminders, and broadcasts." value={<span>{security?.email ? <span className="text-emerald-400">Configured</span> : <span className="text-neutral-400">Not configured</span>}</span>} action={<Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold" onClick={() => setSmtpOpen(true)}><Mail className="mr-1.5 h-4 w-4" /> Configure SMTP</Button>} />
          </SettingsGroup>
        </AdminSection>
      )}

      {/* About Page Team — always visible */}
      <div className="mt-8"><AboutTeamManager /></div>

      {/* Security & Audit Log — always visible */}
      <div className="mt-5"><AdminAuditLog /></div>

      {/* Modals */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="glass-panel max-h-[92dvh] overflow-y-auto border-white/15 sm:max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Change administrator email</DialogTitle>
            <DialogDescription className="text-neutral-400">Verify your current password, then confirm a code sent to the new address.</DialogDescription>
          </DialogHeader>
          <AdminEmailChange />
        </DialogContent>
      </Dialog>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />

      <Dialog open={securityOpen} onOpenChange={setSecurityOpen}>
        <DialogContent className="glass-panel max-h-[92dvh] overflow-y-auto border-white/15 sm:max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Security &amp; two-step verification</DialogTitle>
            <DialogDescription className="text-neutral-400">Email codes protect sign-in. Each recovery code works once.</DialogDescription>
          </DialogHeader>
          <AdminSecurityPanel />
        </DialogContent>
      </Dialog>

      <Dialog open={telegramOpen} onOpenChange={setTelegramOpen}>
        <DialogContent className="glass-panel max-h-[92dvh] overflow-y-auto border-white/15 sm:max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Telegram Admin Assistant</DialogTitle>
            <DialogDescription className="text-neutral-400">Recovery codes are sent to the Main Admin via this bot.</DialogDescription>
          </DialogHeader>
          <TelegramSettings />
        </DialogContent>
      </Dialog>

      <Dialog open={smtpOpen} onOpenChange={setSmtpOpen}>
        <DialogContent className="glass-panel max-h-[92dvh] overflow-y-auto border-white/15 sm:max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">SMTP email settings</DialogTitle>
            <DialogDescription className="text-neutral-400">Outgoing mail for recovery, reminders, and broadcasts.</DialogDescription>
          </DialogHeader>
          <SmtpSettings />
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}