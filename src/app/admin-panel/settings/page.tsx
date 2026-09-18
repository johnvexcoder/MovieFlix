"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Lock, Users, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdminPage, AdminSection } from "@/components/admin/admin-page";
import { AdminSecurityPanel } from "@/components/admin/admin-security-panel";
import { AdminAuditLog } from "@/components/admin/admin-audit-log";
import { AdminEmailChange } from "@/components/admin/admin-email-change";
import { AdminRecoveryOnboarding } from "@/components/admin/admin-recovery-onboarding";
import { TelegramSettings } from "@/components/admin/telegram-settings";
import { SmtpSettings } from "@/components/admin/smtp-settings";
import { AboutTeamManager } from "@/components/admin/about-team-manager";

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [meId, setMeId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPasswordSelf, setNewPasswordSelf] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    loadAdmins();
    fetch("/api/admin/auth/me").then((r) => r.json()).then((d) => { if (d.success) setMeId(d.data.id); }).catch(() => {});
  }, []);

  async function loadAdmins() {
    const r = await fetch("/api/admin/admins");
    const d = await r.json();
    if (d.success) setAdmins(d.data.admins);
  }

  async function handleCreateAdmin() {
    if (!newUsername.trim() || !newEmail.trim() || newPassword.length < 8) {
      setPasswordMessage({ ok: false, text: "Username, a valid email, and a password of at least 8 characters are required." });
      return;
    }
    setAdminActionLoading(true);
    setPasswordMessage(null);
    try {
      const r = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim().toLowerCase(), email: newEmail.trim(), password: newPassword }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setCreateOpen(false);
      setNewUsername(""); setNewEmail(""); setNewPassword("");
      await loadAdmins();
    } catch (e) {
      setPasswordMessage({ ok: false, text: e instanceof Error ? e.message : "Failed to create admin" });
    } finally {
      setAdminActionLoading(false);
    }
  }

  async function handleDeleteAdmin(id: string, username: string) {
    if (!confirm(`Remove administrator "${username}"?`)) return;
    setAdminActionLoading(true);
    try {
      const r = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (!d.success) alert(d.error || "Failed to remove admin");
      else await loadAdmins();
    } catch {
      alert("Failed to remove admin");
    } finally {
      setAdminActionLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || newPasswordSelf.length < 8) {
      setPasswordMessage({ ok: false, text: "Enter current password and a new password (min 8 chars)." });
      return;
    }
    if (newPasswordSelf !== confirmPassword) {
      setPasswordMessage({ ok: false, text: "New passwords do not match." });
      return;
    }
    setAdminActionLoading(true);
    setPasswordMessage(null);
    try {
      const r = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: newPasswordSelf }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setCurrentPassword(""); setNewPasswordSelf(""); setConfirmPassword("");
      setPasswordMessage({ ok: true, text: "Password updated successfully." });
    } catch (e) {
      setPasswordMessage({ ok: false, text: e instanceof Error ? e.message : "Failed to change password" });
    } finally {
      setAdminActionLoading(false);
    }
  }

  return (
    <AdminPage
      title="System Settings"
      description="Identity and Administration — admin profile, security, recovery, and email."
    >
      <AdminRecoveryOnboarding />

      <AdminSection>
        <SmtpSettings />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <AdminSecurityPanel />
          <AdminEmailChange />
        </div>

        <TelegramSettings />

        <AboutTeamManager />

        <div className="grid items-start gap-5 xl:grid-cols-2">
          {/* Administrators Roster */}
          <section className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <Users className="h-5 w-5 text-blue-400" />
                <div>
                  <h2>Administrators roster</h2>
                  <p>Administrators with panel access.</p>
                </div>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="btn-brand h-9 rounded-xl text-xs font-bold">
                <Plus className="mr-1.5 h-4 w-4" /> Add Admin
              </Button>
            </div>
            <div className="space-y-2.5">
              {admins.length === 0 ? (
                <p className="text-xs text-neutral-400">No additional administrators found.</p>
              ) : (
                admins.map((adm) => (
                  <div key={adm.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 text-sm font-bold text-slate-950">
                        {adm.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{adm.username}</p>
                        <p className="break-all text-[11px] text-cyan-200">{adm.email || "Email setup required"}</p>
                        <p className="text-[11px] text-neutral-400">{adm.id === meId ? "Current Active Session" : `Created ${new Date(adm.createdAt).toLocaleDateString()}`}</p>
                      </div>
                    </div>
                    {adm.id !== meId && (
                      <Button variant="ghost" size="sm" className="rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300" disabled={adminActionLoading} onClick={() => handleDeleteAdmin(adm.id, adm.username)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Change My Password */}
          <section className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title">
                <Lock className="h-5 w-5 text-amber-400" />
                <div>
                  <h2>Update administrator password</h2>
                  <p>Change the password for your own account.</p>
                </div>
              </div>
            </div>
            <div className="admin-stack">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Current password</Label>
                <div className="relative">
                  <Input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 pr-12 text-white" />
                  <button type="button" onClick={() => setShowCurrentPassword((v) => !v)} aria-label="Show current password" className="absolute inset-y-0 right-0 mt-1.5 flex w-11 items-center justify-center text-neutral-400">{showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>
              <div className="admin-form-row">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">New password</Label>
                  <div className="relative">
                    <Input type={showNewPassword ? "text" : "password"} value={newPasswordSelf} onChange={(e) => setNewPasswordSelf(e.target.value)} placeholder="Min 8 characters" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 pr-12 text-white" />
                    <button type="button" onClick={() => setShowNewPassword((v) => !v)} aria-label="Show new password" className="absolute inset-y-0 right-0 mt-1.5 flex w-11 items-center justify-center text-neutral-400">{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Confirm new password</Label>
                  <div className="relative">
                    <Input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 pr-12 text-white" />
                    <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} aria-label="Show confirm password" className="absolute inset-y-0 right-0 mt-1.5 flex w-11 items-center justify-center text-neutral-400">{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                </div>
              </div>
              {passwordMessage && (
                <div className={`rounded-2xl border p-3.5 text-xs font-semibold ${passwordMessage.ok ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400" : "border-red-500/30 bg-red-950/40 text-red-400"}`}>{passwordMessage.text}</div>
              )}
              <Button onClick={handleChangePassword} disabled={adminActionLoading} className="btn-brand rounded-xl text-xs font-bold">
                {adminActionLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />} Change Password
              </Button>
            </div>
          </section>
        </div>

        <AdminAuditLog />
      </AdminSection>

      {/* Create Admin Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glass-panel max-h-[calc(100dvh-1rem)] overflow-y-auto border-white/15 p-4 sm:max-w-md sm:rounded-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Create Administrator</DialogTitle>
            <DialogDescription className="text-neutral-400">Grant admin privileges for panel & library configuration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Admin username</Label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="e.g. moderator" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" autoFocus />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Admin recovery email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@example.com" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Admin password</Label>
              <div className="relative mt-1.5">
                <Input type={showCreatePassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" className="h-11 rounded-xl border-white/10 bg-white/5 pr-12 text-white" />
                <button type="button" onClick={() => setShowCreatePassword((v) => !v)} aria-label="Show password" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-neutral-400 hover:text-white">{showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateAdmin} disabled={adminActionLoading} className="btn-brand rounded-xl">
              {adminActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create Admin
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}