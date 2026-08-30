"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Settings,
  Loader2,
  Save,
  Key,
  Database,
  Shield,
  Users,
  Plus,
  Trash2,
  Lock,
  Sparkles,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { checkAdminSession } from "@/lib/client-auth";
import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";

interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Administrators
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  // Change own password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPasswordSelf, setNewPasswordSelf] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Settings state
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [scanInterval, setScanInterval] = useState(10);
  const [maxSessions, setMaxSessions] = useState(3);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [trialMaxDuration, setTrialMaxDuration] = useState(168);
  const [trialDefaultDuration, setTrialDefaultDuration] = useState(72);

  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");

  // Reminder Settings
  const [reminderDays, setReminderDays] = useState(3);
  const [reminderMessage, setReminderMessage] = useState("Your subscription is expiring soon. Please renew your account to continue watching.");

  useEffect(() => {
    checkAuth();
    loadSettings();
    loadAdmins();
  }, []);

  async function checkAuth() {
    const authed = await checkAdminSession();
    if (!authed) {
      router.push("/admin-panel/login");
      return;
    }
    const response = await fetch("/api/admin/auth/me");
    const data = await response.json();
    if (data.success) {
      setMeId(data.data.id);
    }
  }

  async function loadAdmins() {
    const response = await fetch("/api/admin/admins");
    const data = await response.json();
    if (data.success) {
      setAdmins(data.data.admins);
    }
  }

  async function handleCreateAdmin() {
    if (!newUsername.trim() || newPassword.length < 6) {
      setPasswordMessage({ ok: false, text: "Username is required and password must be at least 6 characters." });
      return;
    }
    setAdminActionLoading(true);
    setPasswordMessage(null);
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword }),
      });
      const data = await response.json();
      if (data.success) {
        setCreateOpen(false);
        setNewUsername("");
        setNewPassword("");
        await loadAdmins();
      } else {
        setPasswordMessage({ ok: false, text: data.error || "Failed to create admin" });
      }
    } catch {
      setPasswordMessage({ ok: false, text: "Failed to create admin" });
    } finally {
      setAdminActionLoading(false);
    }
  }

  async function handleDeleteAdmin(id: string, username: string) {
    if (!confirm(`Remove administrator "${username}"?`)) return;
    setAdminActionLoading(true);
    try {
      const response = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        await loadAdmins();
      } else {
        alert(data.error || "Failed to remove admin");
      }
    } catch {
      alert("Failed to remove admin");
    } finally {
      setAdminActionLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || newPasswordSelf.length < 6) {
      setPasswordMessage({ ok: false, text: "Enter current password and a new password (min 6 chars)." });
      return;
    }
    if (newPasswordSelf !== confirmPassword) {
      setPasswordMessage({ ok: false, text: "New passwords do not match." });
      return;
    }
    setAdminActionLoading(true);
    setPasswordMessage(null);
    try {
      const response = await fetch("/api/admin/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: newPasswordSelf }),
      });
      const data = await response.json();
      if (data.success) {
        setCurrentPassword("");
        setNewPasswordSelf("");
        setConfirmPassword("");
        setPasswordMessage({ ok: true, text: "Password updated successfully." });
      } else {
        setPasswordMessage({ ok: false, text: data.error || "Failed to change password" });
      }
    } catch {
      setPasswordMessage({ ok: false, text: "Failed to change password" });
    } finally {
      setAdminActionLoading(false);
    }
  }

  async function loadSettings() {
    setTmdbApiKey(process.env.NEXT_PUBLIC_TMDB_API_KEY || "");
    try {
      const response = await fetch("/api/admin/settings");
      const data = await response.json();
      if (data.success && data.data?.settings) {
        const s = data.data.settings;
        if (s.smtp_host) setSmtpHost(s.smtp_host);
        if (s.smtp_port) setSmtpPort(s.smtp_port);
        if (s.smtp_user) setSmtpUser(s.smtp_user);
        if (s.smtp_from) setSmtpFrom(s.smtp_from);
        // SMTP password is never returned; show a placeholder indicating whether one is set.
        setSmtpPass(s.smtp_pass_set === "true" ? "••••••••••" : "");
        if (s.reminder_days) setReminderDays(parseInt(s.reminder_days));
        if (s.reminder_message) setReminderMessage(s.reminder_message);
        if (s.max_sessions) setMaxSessions(parseInt(s.max_sessions));
        if (s.session_timeout) setSessionTimeout(parseInt(s.session_timeout));
      }
    } catch (e) {
      console.error("Failed to load DB settings", e);
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Don't send the masked placeholder back; the backend preserves the stored
      // password when smtp_pass is empty. Only a fresh value is saved.
      const smtpPassToSend = smtpPass === "••••••••••" ? "" : smtpPass;
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_user: smtpUser,
            smtp_pass: smtpPassToSend,
            smtp_from: smtpFrom,
            reminder_days: reminderDays.toString(),
            reminder_message: reminderMessage,
            max_sessions: maxSessions.toString(),
            session_timeout: sessionTimeout.toString(),
          }
        }),
      });
    } catch (e) {
      console.error("Failed to save settings", e);
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSaving(false);
    setSaveToast("Settings saved successfully.");
    setTimeout(() => setSaveToast(null), 4000);
  }

  if (loading) {
    return (
      <div className="cinematic-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] text-white select-none">
      <div className="mx-auto max-w-4xl px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin-panel")}
              className="h-10 w-10 rounded-full bg-white/5 text-neutral-300 hover:bg-white/15 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Platform Settings
              </h1>
              <p className="text-xs text-neutral-400">
                Configure TMDB metadata provider, scanner intervals, session security, and administrators
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="btn-brand rounded-xl text-xs font-bold">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save Configuration
          </Button>
        </div>

        {saveToast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs font-semibold text-emerald-400"
          >
            <CheckCircle className="h-4 w-4" />
            <span>{saveToast}</span>
          </motion.div>
        )}

        <div className="space-y-6">
          {/* TMDB API Integration */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Key className="h-5 w-5 text-[#e50914]" />
                <h2 className="text-lg font-bold text-white">TMDB Metadata Integration</h2>
              </div>
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-[#e50914] hover:underline"
              >
                <span>Get API Key</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">TMDB API Key (v3 auth)</Label>
              <Input
                type="password"
                value={tmdbApiKey}
                onChange={(e) => setTmdbApiKey(e.target.value)}
                placeholder="Enter 32-character TMDB API Key"
                className="h-11 rounded-xl border-white/10 bg-white/5 text-white font-mono"
              />
              <p className="text-[11px] text-neutral-400">
                Used to fetch movie artwork, high-resolution backdrops, plot summaries, and episode stills.
              </p>
            </div>
          </div>

          {/* Scanner & Session Settings */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Scanner */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
              <div className="mb-4 flex items-center gap-2.5">
                <Database className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Filesystem Scanner</h2>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Periodic Interval (Minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={scanInterval}
                  onChange={(e) => setScanInterval(parseInt(e.target.value) || 10)}
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white"
                />
                <p className="text-[11px] text-neutral-400">
                  How often to automatically check configured library folders.
                </p>
              </div>
            </div>

            {/* Sessions */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
              <div className="mb-4 flex items-center gap-2.5">
                <Shield className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">Session Security</h2>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Max Concurrent Streams</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={maxSessions}
                  onChange={(e) => setMaxSessions(parseInt(e.target.value) || 3)}
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white"
                />
                <p className="text-[11px] text-neutral-400">
                  Maximum simultaneous video streams permitted per account (Session Security).
                </p>
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300 mt-4 block">Session Idle Timeout (Minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 30)}
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white"
                />
                <p className="text-[11px] text-neutral-400">
                  Automatically log out sessions inactive for this long.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* SMTP Settings */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
              <div className="mb-4 flex items-center gap-2.5">
                <Database className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-bold text-white">SMTP Email Settings</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">SMTP Host</Label>
                  <Input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.com"
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">SMTP Port</Label>
                    <Input
                      type="text"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Sender Email (From)</Label>
                    <Input
                      type="email"
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      placeholder="noreply@movieflix.local"
                      className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">SMTP Username</Label>
                  <Input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="Username"
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">SMTP Password</Label>
                  <Input
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="Password"
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Expiry Reminder */}
            <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
              <div className="mb-4 flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Expiration Reminder</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Show Reminder Before (Days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={reminderDays}
                    onChange={(e) => setReminderDays(parseInt(e.target.value) || 3)}
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">
                    How many days before expiration to show the popup.
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Custom Reminder Message</Label>
                  <textarea
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    rows={4}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]"
                    placeholder="Your subscription is expiring soon..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          <PaymentMethodsManager />

          {/* Administrators Roster */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Users className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-bold text-white">Administrators Roster</h2>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="btn-brand h-9 rounded-xl text-xs font-bold">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Admin
              </Button>
            </div>

            <div className="space-y-2.5">
              {admins.length === 0 ? (
                <p className="text-xs text-neutral-400">No additional administrators found.</p>
              ) : (
                admins.map((adm) => (
                  <div
                    key={adm.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e50914] to-[#7a0006] text-sm font-bold text-white">
                        {adm.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{adm.username}</p>
                        <p className="text-[11px] text-neutral-400">
                          {adm.id === meId ? "Current Active Session" : `Created ${new Date(adm.createdAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>

                    {adm.id !== meId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        disabled={adminActionLoading}
                        onClick={() => handleDeleteAdmin(adm.id, adm.username)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Change My Password */}
          <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
            <div className="mb-4 flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Update Administrator Password</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">New Password</Label>
                  <Input
                    type="password"
                    value={newPasswordSelf}
                    onChange={(e) => setNewPasswordSelf(e.target.value)}
                    placeholder="Min 6 characters"
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>

              {passwordMessage && (
                <div
                  className={`rounded-2xl border p-3.5 text-xs font-semibold ${
                    passwordMessage.ok
                      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                      : "border-red-500/30 bg-red-950/40 text-red-400"
                  }`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={adminActionLoading}
                  className="btn-brand rounded-xl text-xs font-bold"
                >
                  {adminActionLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />}
                  Change Password
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Author Credits & Support Footer */}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-400">Author:</span>
            <span className="font-bold text-white">John Vex Coder</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-500">MovieFlix Platform</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/johnvexcoder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 font-semibold text-white transition-all hover:border-white/30 hover:bg-white/10"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>

            <a
              href="https://ko-fi.com/johnvexcoder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 font-bold text-amber-300 transition-all hover:bg-amber-500/20 shadow-sm"
            >
              <span>☕</span>
              <span>Buy me a coffee</span>
            </a>
          </div>
        </footer>
      </div>

      {/* Create Admin Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Create Administrator</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Grant admin privileges for panel & library configuration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Admin Username</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. moderator"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Admin Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAdmin} disabled={adminActionLoading} className="btn-brand rounded-xl">
              {adminActionLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Create Admin
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
