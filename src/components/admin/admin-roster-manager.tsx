"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  twoFactorEnabled: boolean;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  setupCompletedAt: string | null;
}

function StatusBadge({ status, role, twoFactor }: { status: string; role: string; twoFactor: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-300">{role === "main_admin" ? "Main Admin" : "Admin"}</span>
      {status === "pending_setup" ? (
        <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">Pending Setup</span>
      ) : status === "disabled" ? (
        <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-300">Disabled</span>
      ) : (
        <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-300">Active</span>
      )}
      {twoFactor && <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">2FA</span>}
    </div>
  );
}

export function AdminRosterManager({ selfId }: { selfId?: string | null }) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [meId, setMeId] = useState<string | null>(selfId ?? null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);

  async function load() {
    const r = await fetch("/api/admin/admins", { cache: "no-store" });
    const d = await r.json();
    if (d.success) {
      setAdmins(d.data.admins);
      if (d.data.selfId) setMeId(d.data.selfId);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice(null);
    try {
      const r = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setUsername(""); setEmail(""); setAddOpen(false);
      setNotice(`Invitation sent to ${d.data.admin.email}.`);
      await load();
      setTimeout(() => setNotice(null), 5000);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not invite administrator");
    } finally {
      setBusy(false);
    }
  }

  async function resend(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/admins/${id}/resend`, { method: "POST" });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setNotice(d.message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not resend");
    } finally {
      setBusy(false);
      setTimeout(() => setNotice(null), 5000);
    }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this invitation? The pending administrator will be disabled.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/admins/${id}/cancel`, { method: "POST" });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setNotice(d.message);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
      setTimeout(() => setNotice(null), 5000);
    }
  }

  async function removeAdmin() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/admins/${removeTarget.id}`, { method: "DELETE" });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setRemoveTarget(null);
      setNotice("Administrator removed.");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not remove administrator");
    } finally {
      setBusy(false);
      setTimeout(() => setNotice(null), 5000);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-title">
          <div>
            <h2>Administrators with panel access</h2>
            <p>Invite and manage administrator accounts. Invited admins set their own password.</p>
          </div>
        </div>
        <Button onClick={() => { setAddOpen(true); setError(""); }} className="btn-brand rounded-xl text-xs font-bold">
          <Plus className="mr-1.5 h-4 w-4" /> Add Admin
        </Button>
      </div>

      {notice && <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-300">{notice}</p>}
      {error && <p className="mb-3 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs font-semibold text-red-200">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>
      ) : admins.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">No administrators yet.</p>
      ) : (
        <div className="space-y-2.5">
          {admins.map((a) => {
            const isMe = a.id === meId;
            const isPending = a.status === "pending_setup";
            return (
              <div key={a.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-sm font-bold text-slate-950">{a.username.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-white">{a.username}</p>
                      {isMe && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-neutral-300">You</span>}
                    </div>
                    <p className="break-all text-[11px] text-neutral-400">{a.email || "Email not set"}</p>
                    <div className="mt-1"><StatusBadge status={a.status} role={a.role} twoFactor={a.twoFactorEnabled} /></div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {isPending ? (
                    <>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => resend(a.id)} className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold"><Send className="mr-1 h-3.5 w-3.5" /> Resend</Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => cancel(a.id)} className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold text-orange-300"><X className="mr-1 h-3.5 w-3.5" /> Cancel</Button>
                    </>
                  ) : (
                    !isMe && (
                      <Button variant="destructive" size="sm" disabled={busy} onClick={() => setRemoveTarget(a)} className="rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-semibold text-red-400 hover:bg-red-500/20"><Trash2 className="mr-1 h-3.5 w-3.5" /> Remove</Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Admin (invitation) modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Add Administrator</DialogTitle>
            <DialogDescription className="text-neutral-400">The invited administrator will receive a secure one-time account setup link by email.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addAdmin} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="e.g. johnadmin" required className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" autoFocus />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" required className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
            </div>
            <p className="text-[11px] text-slate-400">No password is created here. The invited administrator chooses their own password through the invitation link.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-xl border-white/10" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy || !username.trim() || !email.trim()} className="btn-brand rounded-xl">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Send Invitation</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Admin confirmation modal */}
      <Dialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Remove Administrator</DialogTitle>
            <DialogDescription className="text-neutral-400">This administrator will no longer be able to access the MovieFlix Admin Panel.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-bold text-white">{removeTarget?.username}</p>
            <p className="text-[11px] text-neutral-400">{removeTarget?.email || "Email not set"}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setRemoveTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl" onClick={removeAdmin} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Remove Admin</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}