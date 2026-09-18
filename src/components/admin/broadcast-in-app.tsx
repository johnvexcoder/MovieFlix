"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Megaphone } from "lucide-react";
import type { BroadcastTargetSpec } from "@/lib/broadcast-targeting";

interface AccountOption { id: string; username: string; }
interface PlanOption { id: string; name: string; }

const DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

export function BroadcastInApp() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<BroadcastTargetSpec["mode"]>("all");
  const [priority, setPriority] = useState("normal");
  const [displayHomepage, setDisplayHomepage] = useState(true);
  const [displayStreaming, setDisplayStreaming] = useState(false);
  const [durationHours, setDurationHours] = useState<number | null>(24);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/admin/accounts", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d.success) setAccounts(d.data?.accounts ?? []); }).catch(() => {});
    fetch("/api/admin/plans", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d.success) setPlans(d.data?.plans ?? []); }).catch(() => {});
  }, []);

  function buildAudience(): BroadcastTargetSpec {
    switch (mode) {
      case "ids": return { mode: "ids", ids: selectedIds };
      case "plan": return { mode: "plan", planIds: selectedPlans };
      case "lifetime": return { mode: "lifetime" };
      case "limited": return { mode: "limited" };
      case "expiring": return { mode: "expiring", windowHours: 72 };
      case "active": return { mode: "active" };
      case "offline": return { mode: "offline" };
      default: return { mode: "all" };
    }
  }

  async function preview() {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/admin/messages/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience: buildAudience() }) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setRecipientCount(d.data.count);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not resolve audience"); } finally { setBusy(false); }
  }

  async function send() {
    if (!message.trim()) return setError("Message is required.");
    setBusy(true); setError(null);
    try {
      const expiresAt = durationHours ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString() : null;
      const r = await fetch("/api/admin/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), message: message.trim(), audience: buildAudience(), displayHomepage, displayStreaming, priority, expiresAt }) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setDone(true);
      setTimeout(() => { setDone(false); setTitle(""); setMessage(""); setRecipientCount(null); }, 2500);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send announcement"); } finally { setBusy(false); }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-title">
          <Megaphone className="h-5 w-5 text-cyan-300" />
          <div>
            <h2>In-App announcement</h2>
            <p>Send an announcement shown inside MovieFlix. This is not email.</p>
          </div>
        </div>
      </div>

      <div className="admin-stack">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Audience</Label>
          <select value={mode} onChange={(e) => setMode(e.target.value as BroadcastTargetSpec["mode"])} className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none">
            <option value="all">All Users</option>
            <option value="active">Online Users</option>
            <option value="ids">Selected Users</option>
            <option value="plan">On Plan</option>
            <option value="lifetime">Lifetime Users</option>
            <option value="limited">Limited Plan Users</option>
            <option value="expiring">Expiring Soon (3 days)</option>
            <option value="offline">Offline Users</option>
          </select>
        </div>

        {mode === "ids" && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Selected users</Label>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-2">
              {accounts.map((a) => (
                <label key={a.id} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm text-neutral-200 hover:bg-white/5">
                  <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={(e) => setSelectedIds((prev) => (e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id)))} className="h-4 w-4" /> {a.username}
                </label>
              ))}
            </div>
          </div>
        )}
        {mode === "plan" && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Plans</Label>
            <div className="mt-2 space-y-1 rounded-xl border border-white/10 bg-white/5 p-2">
              {plans.map((p) => (
                <label key={p.id} className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm text-neutral-200 hover:bg-white/5">
                  <input type="checkbox" checked={selectedPlans.includes(p.id)} onChange={(e) => setSelectedPlans((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)))} className="h-4 w-4" /> {p.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="admin-form-row">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Service update" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Priority</Label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none">
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Duration</Label>
            <select value={durationHours ?? "manual"} onChange={(e) => setDurationHours(e.target.value === "manual" ? null : parseInt(e.target.value))} className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none">
              {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
              <option value="manual">Until manually disabled</option>
            </select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Message</Label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" placeholder="Your announcement…" />
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-200"><input type="checkbox" checked={displayHomepage} onChange={(e) => setDisplayHomepage(e.target.checked)} className="h-4 w-4" /> Homepage</label>
          <label className="flex items-center gap-2 text-sm text-neutral-200"><input type="checkbox" checked={displayStreaming} onChange={(e) => setDisplayStreaming(e.target.checked)} className="h-4 w-4" /> During streaming</label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-300">Recipients: <b className="text-white">{recipientCount ?? "—"}</b></span>
          <Button variant="outline" size="sm" onClick={preview} disabled={busy} className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Preview count"}</Button>
          <Button onClick={send} disabled={busy || !message.trim()} className="btn-brand rounded-xl text-xs font-bold">{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Megaphone className="mr-1.5 h-4 w-4" />} Send announcement</Button>
        </div>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs font-semibold text-red-200">{error}</p>}
        {done && <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-300">Announcement sent.</p>}
      </div>
    </section>
  );
}