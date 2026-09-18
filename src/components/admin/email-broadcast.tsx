"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Send, Users, Mail, CheckCircle2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Account {
  id: string;
  username: string;
  email: string | null;
  isStreaming?: boolean;
  subscriptionType?: "permanent" | "limited";
  subscriptionActive?: boolean;
}

interface Plan {
  id: string;
  name: string;
  isLifetime?: boolean;
}

type TargetMode =
  | "all"
  | "single"
  | "selected"
  | "plan"
  | "lifetime"
  | "limited"
  | "expiring"
  | "active"
  | "offline";

const MODES: { value: TargetMode; label: string }[] = [
  { value: "all", label: "All Users" },
  { value: "single", label: "Specific User" },
  { value: "selected", label: "Selected Users" },
  { value: "plan", label: "On Plan" },
  { value: "lifetime", label: "Lifetime Users" },
  { value: "limited", label: "Limited Plan Users" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "active", label: "Active Users" },
  { value: "offline", label: "Offline Users" },
];

const EXPIRING_WINDOWS = [24, 72, 168, 336, 720]; // hours: 24h,3d,7d,14d,30d

export function EmailBroadcastAdmin() {
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<TargetMode>("all");
  const [singleId, setSingleId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [expiringHours, setExpiringHours] = useState(72);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ count: number; sample: { username: string; hasEmail: boolean }[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [accRes, planRes] = await Promise.all([
          fetch("/api/admin/accounts", { cache: "no-store" }),
          fetch("/api/admin/promos", { cache: "no-store" }),
        ]);
        const accData = await accRes.json();
        const planData = await planRes.json();
        if (mounted) {
          if (accData.success) setAllAccounts((accData.data.accounts || []).filter((a: Account) => a.email));
          if (planData.success) setPlans(planData.data.plans || []);
        }
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allAccounts;
    return allAccounts.filter((a) =>
      (a.username || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)
    );
  }, [allAccounts, search]);

  function buildTarget() {
    switch (mode) {
      case "all":
        return { mode: "all" };
      case "single":
        return { mode: "ids", ids: singleId ? [singleId] : [] };
      case "selected":
        return { mode: "ids", ids: Array.from(selectedIds) };
      case "plan":
        return { mode: "plan", planIds: Array.from(selectedPlanIds) };
      case "lifetime":
        return { mode: "lifetime" };
      case "limited":
        return { mode: "limited" };
      case "expiring":
        return { mode: "expiring", windowHours: expiringHours };
      case "active":
        return { mode: "active" };
      case "offline":
        return { mode: "offline" };
    }
  }

  async function fetchPreview() {
    setPreviewing(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: buildTarget() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPreview({ count: data.data.count, sample: data.data.sample });
      } else {
        setResult({ ok: false, text: data.error || "Could not resolve recipients." });
      }
    } catch {
      setResult({ ok: false, text: "Unexpected error while resolving recipients." });
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSend() {
    if (sending || !preview) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: buildTarget(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ ok: true, text: data.data.message || "Email sent successfully." });
        setSubject("");
        setMessage("");
        setPreview(null);
        if (mode === "single") setSingleId("");
        if (mode === "selected") setSelectedIds(new Set());
      } else {
        setResult({ ok: false, text: data.error || "Failed to send email." });
      }
    } catch {
      setResult({ ok: false, text: "Unexpected error while sending email." });
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-[var(--brand)]/60 focus:bg-white/10 transition-colors";
  const isAll = mode === "all";
  const confirmStrong = isAll;

  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl mt-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Mail className="h-5 w-5 text-[var(--brand)]" />
        <h2 className="text-xl font-bold text-white">Broadcast Email / Message</h2>
      </div>

      {/* Recipient mode selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => { setMode(m.value); setResult(null); setPreview(null); }}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              mode === m.value
                ? "bg-primary text-white"
                : "bg-white/10 text-neutral-300 hover:bg-white/20"
            }`}
          >
            {m.value === "all" && <Users className="mr-1.5 inline h-3.5 w-3.5" />}
            {m.label}
          </button>
        ))}
      </div>

      {/* Mode-specific controls */}
      {mode === "single" && (
        <select value={singleId} onChange={(e) => setSingleId(e.target.value)} className={`${inputCls} mb-4 cursor-pointer`} disabled={loading}>
          <option value="">Select a user…</option>
          {allAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.username} — {a.email}</option>
          ))}
        </select>
      )}

      {mode === "selected" && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users by username or email…"
              className={`${inputCls} py-2`}
            />
          </div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-400">Selected: {selectedIds.size}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelectedIds(new Set(filteredAccounts.map((a) => a.id)))}
                className="text-[11px] font-bold text-[var(--brand)] hover:underline">Select all filtered</button>
              <button type="button" onClick={() => setSelectedIds(new Set())}
                className="text-[11px] font-bold text-neutral-400 hover:underline">Clear</button>
            </div>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {filteredAccounts.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--brand)]"
                  checked={selectedIds.has(a.id)}
                  onChange={(e) => {
                    const next = new Set(selectedIds);
                    if (e.target.checked) next.add(a.id);
                    else next.delete(a.id);
                    setSelectedIds(next);
                  }}
                />
                <span className="text-sm text-white">{a.username}</span>
                <span className="ml-auto text-[11px] text-neutral-500">{a.email}</span>
              </label>
            ))}
            {filteredAccounts.length === 0 && (
              <p className="px-2 py-3 text-xs text-neutral-500">No matching users.</p>
            )}
          </div>
        </div>
      )}

      {mode === "plan" && (
        <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400">Send to users on:</p>
          <div className="flex flex-wrap gap-2">
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const next = new Set(selectedPlanIds);
                  if (next.has(p.id)) next.delete(p.id);
                  else next.add(p.id);
                  setSelectedPlanIds(next);
                }}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                  selectedPlanIds.has(p.id)
                    ? "bg-primary text-white"
                    : "bg-white/10 text-neutral-300 hover:bg-white/20"
                }`}
              >
                {p.name}
              </button>
            ))}
            {plans.length === 0 && <p className="text-xs text-neutral-500">No active plans.</p>}
          </div>
        </div>
      )}

      {mode === "expiring" && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs font-bold text-neutral-400">Expires within:</span>
          <select value={expiringHours} onChange={(e) => setExpiringHours(Number(e.target.value))}
            className={`${inputCls} cursor-pointer py-2`}>
            <option value={24}>24 hours</option>
            <option value={72}>3 days</option>
            <option value={168}>7 days</option>
            <option value={336}>14 days</option>
            <option value={720}>30 days</option>
          </select>
        </div>
      )}

      {mode === "active" && (
        <p className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-400">
          Sends to accounts currently streaming (fresh playback heartbeat).
        </p>
      )}
      {mode === "offline" && (
        <p className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-400">
          Sends to accounts not currently streaming.
        </p>
      )}

      {/* Subject */}
      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-400">Subject</label>
        <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200}
          placeholder="e.g. Important update" className={inputCls} />
      </div>

      {/* Message */}
      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-400">Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={10000}
          placeholder="Write your announcement or message for your users…" className={`${inputCls} resize-y`} />
      </div>

      {/* Recipient preview */}
      <div className="mb-3">
        <Button type="button" variant="ghost" onClick={fetchPreview} disabled={previewing || loading}
          className="mb-2 h-10 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/20">
          {previewing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
          {preview ? "Refresh recipient count" : "Preview recipients"}
        </Button>
        {preview && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="mb-2 text-sm font-bold text-[var(--brand)]">Recipients: {preview.count}</p>
            {preview.sample.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {preview.sample.map((s, i) => (
                  <span key={i} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-neutral-300">
                    {s.username}{!s.hasEmail ? " (no email)" : ""}
                  </span>
                ))}
                {preview.count > preview.sample.length && (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-neutral-500">
                    +{preview.count - preview.sample.length} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
          result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"
        }`}>
          {result.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{result.text}</span>
        </div>
      )}

      <Button type="button" onClick={() => {
        if (!subject.trim() || !message.trim()) {
          setResult({ ok: false, text: "Please provide both a subject and a message." });
          return;
        }
        if (!preview) {
          setResult({ ok: false, text: "Please preview recipients first." });
          return;
        }
        if (preview.count === 0) {
          setResult({ ok: false, text: "No recipients match this audience." });
          return;
        }
        setConfirmOpen(true);
      }} disabled={sending}
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60 ${confirmStrong ? "" : ""}`}>
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send Email</>}
      </Button>

      {/* Confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setConfirmOpen(false)}>
          <div className={`w-full max-w-sm rounded-3xl border p-6 shadow-2xl ${confirmStrong ? "border-red-500/30 bg-red-950/30" : "border-white/15 bg-[#12141c]"}`}
            onClick={(e) => e.stopPropagation()}>
            <h3 className={`text-lg font-bold ${confirmStrong ? "text-red-300" : "text-white"}`}>
              {confirmStrong ? "Send to everyone?" : "Confirm broadcast"}
            </h3>
            <p className="mt-2 text-sm text-neutral-300">
              Send this email to <strong>{preview?.count}</strong> user{preview?.count === 1 ? "" : "s"}?
              {confirmStrong && <span className="mt-1 block text-xs text-red-300">This will reach your entire user base.</span>}
            </p>
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={() => setConfirmOpen(false)} className="h-11 flex-1 rounded-xl bg-white/10 text-sm font-bold text-white hover:bg-white/20">
                Cancel
              </Button>
              <Button type="button" onClick={handleSend} disabled={sending}
                className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-white hover:opacity-90">
                {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <p className="mt-2 text-[11px] text-neutral-500">Loading users and plans…</p>}
    </div>
  );
}