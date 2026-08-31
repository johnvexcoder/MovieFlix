"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  Users,
  Film,
  Settings,
  LogOut,
  Plus,
  Trash2,
  Shield,
  Clock,
  Timer,
  CalendarClock,
  Activity,
  KeyRound,
  Search,
  Sparkles,
  Server,
  FolderOpen,
  Lock,
  Megaphone,
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
import { Badge } from "@/components/ui/badge";
import { checkAdminSession } from "@/lib/client-auth";
import { PaymentSubmissionsAdmin } from "@/components/admin/payment-submissions";
import { MessageHistory } from "@/components/admin/message-history";
import { ContactSubmissionsAdmin } from "@/components/admin/contact-submissions";

interface AdminUser {
  id: string;
  username: string;
}

interface Account {
  id: string;
  username: string;
  isTemp: boolean;
  isLocked: boolean;
  durationHours: number | null;
  expiresAt: string | null;
  createdAt: string;
  profileCount: number;
  isActive: boolean;
  lastIp: string | null;
}

function formatRemaining(expiresAt: string | null, now: number): string {
  if (!expiresAt) return "Permanent";
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return "Expired";
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function remainingFraction(account: Account, now: number): number | null {
  if (!account.expiresAt) return null;
  const end = new Date(account.expiresAt).getTime();
  const start = new Date(account.createdAt).getTime();
  const total = end - start;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (end - now) / total));
}

function accountTone(account: Account, now: number): "green" | "amber" | "red" {
  if (!account.isActive || !account.expiresAt) return account.isActive ? "green" : "red";
  const msLeft = new Date(account.expiresAt).getTime() - now;
  if (msLeft <= 0) return "red";
  if (msLeft < 1000 * 60 * 60 * 24) return "red";
  if (msLeft < 1000 * 60 * 60 * 24 * 3) return "amber";
  return "green";
}

const toneColors = {
  green: {
    bar: "bg-emerald-500",
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  amber: {
    bar: "bg-amber-400",
    text: "text-amber-400",
    badge: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  },
  red: {
    bar: "bg-red-500",
    text: "text-red-400",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

export default function AdminPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [ipInfo, setIpInfo] = useState<Map<string, { ip: string | null; location: string | null }>>(new Map());

  // Add account form
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [weeks, setWeeks] = useState<number | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // Extend account form
  const [extendAccount, setExtendAccount] = useState<Account | null>(null);
  const [additionalHours, setAdditionalHours] = useState<number | null>(24);
  const [extending, setExtending] = useState(false);

  // Reset password form
  const [resetAccount, setResetAccount] = useState<Account | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Send message form
  const [messageDialog, setMessageDialog] = useState<{
    account: Account | null; // null => broadcast
  } | null>(null);
  const [messageText, setMessageText] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Per-account delete guard: prevents double-submits while a delete request
  // is in flight (a duplicate DELETE from a double click would otherwise hit
  // the server twice and surface a confusing error on the second call).
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchAccounts();
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkAuth() {
    try {
      const authed = await checkAdminSession();
      if (!authed) {
        router.push("/admin-panel/login");
        return;
      }
      const response = await fetch("/api/admin/auth/me");
      const data = await response.json();
      if (data.success && data.data) {
        setAdmin(data.data);
      } else {
        router.push("/admin-panel/login");
      }
    } catch {
      router.push("/admin-panel/login");
    }
  }

  async function fetchAccounts() {
    try {
      const response = await fetch("/api/admin/accounts");
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data.accounts);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let mounted = true;
    async function fetchIpInfo() {
      try {
        const res = await fetch("/api/admin/account-ip", { cache: "no-store" });
        const data = await res.json();
        if (data.success && mounted) {
          const map = new Map<string, { ip: string | null; location: string | null }>();
          data.data.accounts.forEach((a: any) => {
            map.set(a.id, {
              ip: a.lastIp || "Not available",
              location: a.lastIp ? "Last connected" : null,
            });
          });
          setIpInfo(map);
        }
      } catch (error) {
        console.error("Failed to fetch IP info:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchIpInfo();
    return () => { mounted = false; };
  }, []);

  async function handleAddAccount() {
    if (!newUsername.trim() || !newPassword.trim()) return;

    const totalHours = (weeks || 0) * 168 + (days || 0) * 24 + (hours || 0);

    setAdding(true);
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          email: newEmail.trim() || undefined,
          fullName: newFullName.trim() || undefined,
          password: newPassword,
          durationHours: totalHours > 0 ? totalHours : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAddModalOpen(false);
        setNewUsername("");
        setNewPassword("");
        setNewEmail("");
        setNewFullName("");
        setWeeks(null);
        setDays(null);
        setHours(null);
        fetchAccounts();
      } else {
        alert(data.error || "Failed to create account");
      }
    } catch {
      alert("Failed to create account");
    } finally {
      setAdding(false);
    }
  }

  async function handleExtend(customHours?: number) {
    const hoursToApply = customHours || additionalHours;
    if (!extendAccount || !hoursToApply || hoursToApply <= 0) return;

    setExtending(true);
    try {
      const response = await fetch(`/api/admin/accounts/${extendAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalHours: hoursToApply }),
      });

      const data = await response.json();

      if (data.success) {
        setExtendAccount(null);
        setAdditionalHours(24);
        fetchAccounts();
      } else {
        alert(data.error || "Failed to extend account");
      }
    } catch {
      alert("Failed to extend account");
    } finally {
      setExtending(false);
    }
  }

  async function handleResetPassword() {
    if (!resetAccount || !resetPassword.trim() || resetPassword.trim().length < 6) return;

    setResetting(true);
    try {
      const response = await fetch(`/api/admin/accounts/${resetAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPassword.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setResetAccount(null);
        setResetPassword("");
        alert(`Password for "${resetAccount.username}" has been updated.`);
      } else {
        alert(data.error || "Failed to reset password");
      }
    } catch {
      alert("Failed to reset password");
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteAccount(id: string, username: string) {
    if (deletingId) return; // duplicate-submit guard
    if (!confirm(`Delete account "${username}"? All profile data and watch progress will be permanently removed.`)) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/accounts?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        fetchAccounts();
      } else {
        alert(data.error || "Failed to delete account");
      }
    } catch {
      alert("Failed to delete account");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleLock(account: Account) {
    const newLockState = !account.isLocked;
    const action = newLockState ? "Lock" : "Unlock";
    if (!confirm(`${action} account "${account.username}"?`)) return;

    try {
      const response = await fetch(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLocked: newLockState }),
      });

      const data = await response.json();
      if (data.success) {
        fetchAccounts();
      } else {
        alert(data.error || `Failed to ${action.toLowerCase()} account`);
      }
    } catch {
      alert(`Failed to ${action.toLowerCase()} account`);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin-panel/login");
  }

  async function handleSendMessage(account: Account | null) {
    if (!messageText.trim()) {
      alert("Please enter a message.");
      return;
    }
    setSendingMessage(true);
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText.trim(),
          accountId: account ? account.id : null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessageText("");
        setMessageDialog(null);
        setBroadcastOpen(false);
        alert(data.data?.message || "Message sent.");
      } else {
        alert(data.error || "Failed to send message");
      }
    } catch {
      alert("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  }

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => a.username.toLowerCase().includes(q));
  }, [accounts, searchQuery]);

  const durationPreview = useMemo(() => {
    const w = weeks || 0;
    const d = days || 0;
    const h = hours || 0;
    if (w === 0 && d === 0 && h === 0) return null;
    const parts: string[] = [];
    if (w > 0) parts.push(`${w} week${w > 1 ? "s" : ""}`);
    if (d > 0) parts.push(`${d} day${d > 1 ? "s" : ""}`);
    if (h > 0) parts.push(`${h} hour${h > 1 ? "s" : ""}`);
    return parts.join(", ");
  }, [weeks, days, hours]);

  if (loading) {
    return (
      <div className="cinematic-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  const activeCount = accounts.filter((a) => a.isActive).length;
  const expiredCount = accounts.length - activeCount;
  const totalProfiles = accounts.reduce((sum, a) => sum + a.profileCount, 0);

  return (
    <div className="min-h-screen bg-[#070709] text-white select-none">
      {/* Top Ambient Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-red-600/10 via-purple-600/5 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-8">
        {/* Top Navigation Bar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e50914] to-[#800208] shadow-lg shadow-red-950/60 ring-1 ring-white/20">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  MovieFlix Admin Command
                </h1>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Manage streaming credentials, library folders, and system configuration
              </p>
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-white/10 bg-white/5 text-xs font-semibold"
              onClick={() => router.push("/admin-panel/libraries")}
            >
              <FolderOpen className="mr-1.5 h-4 w-4 text-[#e50914]" />
              Libraries
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-white/10 bg-white/5 text-xs font-semibold"
              onClick={() => router.push("/admin-panel/settings")}
            >
              <Settings className="mr-1.5 h-4 w-4" />
              Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout ({admin?.username})
            </Button>
          </div>
        </div>

        {/* Telemetry Stat Cards */}
        <div className="mb-8 grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <div className="glass-panel rounded-2xl p-4 border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Total Accounts
                </p>
                <p className="mt-1 text-2xl font-black text-white">{accounts.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-neutral-400">
                <Users className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Active Subscriptions
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-400">{activeCount}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-neutral-400">
              {expiredCount} expired / inactive
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Total Profiles
                </p>
                <p className="mt-1 text-2xl font-black text-white">{totalProfiles}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <Film className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-4 border border-white/10 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Profiles per Account
                </p>
                <p className="mt-1 text-2xl font-black text-white">
                  {accounts.length ? (totalProfiles / accounts.length).toFixed(1) : "0"}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-neutral-400">
                <Timer className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Account Manager Section */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl">
          {/* Header Controls */}
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <h2 className="text-xl font-bold text-white">User Accounts</h2>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-300">
                {filteredAccounts.length}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <Input
                  type="search"
                  placeholder="Filter accounts…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-xl border-white/10 bg-white/5 pl-9 text-xs text-white"
                />
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setMessageText("");
                  setBroadcastOpen(true);
                }}
                className="h-9 rounded-xl border-white/15 bg-white/5 px-4 text-xs font-bold text-neutral-200 hover:bg-white/15 w-full sm:w-auto"
              >
                <Megaphone className="mr-1.5 h-4 w-4 text-[#e50914]" />
                Broadcast Message
              </Button>

              <Button
                onClick={() => setAddModalOpen(true)}
                className="btn-brand h-9 rounded-xl px-4 text-xs font-bold w-full sm:w-auto"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create Account
              </Button>
            </div>
          </div>

          {/* Accounts List */}
          <div className="space-y-3">
            {filteredAccounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-12 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
                <h3 className="text-base font-bold text-white">No Accounts Found</h3>
                <p className="mt-1 text-xs text-neutral-400">
                  {searchQuery ? "No accounts match your query." : "Create your first trial or permanent account to share access."}
                </p>
              </div>
            ) : (
              filteredAccounts.map((account) => {
                const tone = accountTone(account, now);
                const colors = toneColors[tone];
                const fraction = remainingFraction(account, now);

                return (
                  <motion.div
                    key={account.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-[#121215]/80 p-3 sm:p-4 transition-all hover:border-white/20 hover:bg-[#16161b]"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      {/* Avatar initial */}
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e50914] to-[#7a0006] text-base font-black text-white shadow-md">
                        {account.username.charAt(0).toUpperCase()}
                      </div>

                      {/* Account Details */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-white truncate">
                            {account.username}
                          </span>
                          <span className={`badge-quality ${colors.badge} whitespace-nowrap`}>
                            {account.isActive ? "Active" : "Expired"}
                          </span>
                          <span className="badge-quality border-white/15 text-neutral-400 whitespace-nowrap">
                            {account.isTemp ? "Time-Limited" : "Permanent"}
                          </span>
                          <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                            {account.profileCount} profile{account.profileCount !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-neutral-400">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5 text-neutral-500" />
                            {account.expiresAt
                              ? new Date(account.expiresAt).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "No expiration date"}
                          </span>

                          <span className={`flex items-center gap-1.5 font-semibold tabular-nums ${colors.text}`}>
                            <Clock className="h-3.5 w-3.5" />
                            {account.expiresAt
                              ? `Remaining: ${formatRemaining(account.expiresAt, now)}`
                              : "Unlimited Access"}
                          </span>
                        </div>

                        {/* Progress Meter Bar */}
                        <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                          {fraction === null ? (
                            <div className="h-full w-full rounded-full bg-emerald-500/70" />
                          ) : (
                            <div
                              className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                              style={{ width: `${fraction * 100}%` }}
                            />
                          )}
                        </div>
                      </div>

                      {/* Action Controls */}
                      <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:flex-shrink-0 justify-start sm:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-white/15 bg-white/5 text-[10px] font-semibold hover:bg-white/15 h-8 px-3"
                          onClick={() => handleToggleLock(account)}
                        >
                          <Lock className={`mr-1 h-3 w-3 ${account.isLocked ? 'text-red-400' : 'text-neutral-400'}`} />
                          {account.isLocked ? "Unlock" : "Lock"}
                        </Button>

                        {account.isTemp && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-white/15 bg-white/5 text-[10px] font-semibold hover:bg-white/15 h-8 px-3"
                            onClick={() => {
                              setExtendAccount(account);
                              setAdditionalHours(24);
                            }}
                          >
                            <Clock className="mr-1 h-3 w-3 text-[#e50914]" />
                            Extend
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-white/15 bg-white/5 text-[10px] font-semibold hover:bg-white/15 h-8 px-3"
                          onClick={() => {
                            setResetAccount(account);
                            setResetPassword("");
                          }}
                        >
                          <KeyRound className="mr-1 h-3 w-3 text-amber-400" />
                          Password
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-white/15 bg-white/5 text-[10px] font-semibold hover:bg-white/15 h-8 px-3"
                          onClick={() => {
                            setMessageText("");
                            setMessageDialog({ account });
                          }}
                        >
                          <Megaphone className="mr-1 h-3 w-3 text-[#e50914]" />
                          Message
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingId !== null}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 h-8 px-3"
                          onClick={() => handleDeleteAccount(account.id, account.username)}
                        >
                          {deletingId === account.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Payment Submissions */}
        <PaymentSubmissionsAdmin />

        {/* Sent Messages */}
        <MessageHistory />

        {/* Contact Submissions */}
        <ContactSubmissionsAdmin />

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

      {/* Create Account Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Create User Account</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Provision streaming credentials for friends, family, or trial users.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Username</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. john"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Full Name</Label>
              <Input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Email Address</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="john@example.com"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Access Duration</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <Input
                    type="number"
                    min={0}
                    value={weeks ?? ""}
                    onChange={(e) => setWeeks(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="0"
                    className="h-10 text-center rounded-xl border-white/10 bg-white/5 text-white"
                  />
                  <p className="mt-1 text-center text-[11px] text-neutral-400">Weeks</p>
                </div>
                <div>
                  <Input
                    type="number"
                    min={0}
                    value={days ?? ""}
                    onChange={(e) => setDays(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="0"
                    className="h-10 text-center rounded-xl border-white/10 bg-white/5 text-white"
                  />
                  <p className="mt-1 text-center text-[11px] text-neutral-400">Days</p>
                </div>
                <div>
                  <Input
                    type="number"
                    min={0}
                    value={hours ?? ""}
                    onChange={(e) => setHours(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="0"
                    className="h-10 text-center rounded-xl border-white/10 bg-white/5 text-white"
                  />
                  <p className="mt-1 text-center text-[11px] text-neutral-400">Hours</p>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-neutral-400">
                {durationPreview ? `Expiry set to: ${durationPreview}` : "Leave all at 0 for a permanent lifetime account."}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setAddModalOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button
              className="btn-brand rounded-xl"
              onClick={handleAddAccount}
              disabled={adding || !newUsername.trim() || !newPassword.trim()}
            >
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extend Account Modal */}
      <Dialog open={!!extendAccount} onOpenChange={(open) => !open && setExtendAccount(null)}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Extend Access</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Add more duration to <strong className="text-white">{extendAccount?.username}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Quick Extension Presets */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Quick Presets</Label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[
                  { label: "+12h", hours: 12 },
                  { label: "+24h", hours: 24 },
                  { label: "+3d", hours: 72 },
                  { label: "+7d", hours: 168 },
                ].map((p) => (
                  <Button
                    key={p.label}
                    type="button"
                    variant="outline"
                    onClick={() => setAdditionalHours(p.hours)}
                    className={`rounded-xl text-xs font-bold ${
                      additionalHours === p.hours
                        ? "bg-[#e50914] text-white border-transparent"
                        : "border-white/15 bg-white/5 text-neutral-300"
                    }`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Custom Additional Hours</Label>
              <Input
                type="number"
                min={1}
                value={additionalHours ?? ""}
                onChange={(e) => setAdditionalHours(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="e.g. 48"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setExtendAccount(null)} disabled={extending}>
              Cancel
            </Button>
            <Button
              className="btn-brand rounded-xl"
              onClick={() => handleExtend()}
              disabled={extending || !additionalHours || additionalHours <= 0}
            >
              {extending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
              Extend Time
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={!!resetAccount} onOpenChange={(open) => !open && setResetAccount(null)}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Reset Password</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Set new credentials for <strong className="text-white">{resetAccount?.username}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">New Password</Label>
              <Input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white font-mono"
                autoFocus
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setResetAccount(null)} disabled={resetting}>
              Cancel
            </Button>
            <Button
              className="btn-brand rounded-xl"
              onClick={handleResetPassword}
              disabled={resetting || resetPassword.trim().length < 6}
            >
              {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Update Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Message Modal (targeted or broadcast) */}
      <Dialog
        open={!!messageDialog || broadcastOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMessageDialog(null);
            setBroadcastOpen(false);
          }
        }}
      >
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Send a Message</DialogTitle>
            <DialogDescription className="text-neutral-400">
              {broadcastOpen
                ? "Broadcast this message to every account. It appears as a toast on their next visit."
                : `Send a private message to ${messageDialog?.account?.username}. It appears as a toast on their next visit.`}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Message</Label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Enter your message…"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#e50914]/40"
              autoFocus
            />
            <p className="mt-1 text-right text-[11px] text-neutral-500">{messageText.length}/2000</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-white/10"
              onClick={() => {
                setMessageDialog(null);
                setBroadcastOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="btn-brand rounded-xl"
              onClick={() => handleSendMessage(messageDialog?.account || null)}
              disabled={sendingMessage || messageText.trim().length === 0}
            >
              {sendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
