"use client";
import { useEffect, useState } from "react";
import { Loader2, ScrollText } from "lucide-react";

interface AuditEntry {
  id: string;
  actor: string | null;
  action: string;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "admin.login_success": "Admin sign-in",
  "admin.login_failed": "Failed sign-in",
  "admin.password_changed": "Password changed",
  "recovery.admin_assistant_requested": "Admin Assistant code requested",
  "recovery.admin_assistant_completed": "Recovery completed via Admin Assistant",
  "broadcast.sent": "Broadcast sent",
  "plans.created": "Plan created",
  "plans.updated": "Plan updated",
  "plans.archived": "Plan archived",
};

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/audit", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (mounted && d.success) setEntries(d.data?.log ?? []);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  return (
    <section className="glass-panel min-w-0 rounded-2xl border border-white/10 p-4 shadow-xl sm:rounded-3xl sm:p-6 xl:col-span-2">
      <div className="mb-4 flex items-center gap-2.5">
        <ScrollText className="h-5 w-5 text-cyan-300" />
        <div>
          <h2 className="text-lg font-bold">Security &amp; Audit Log</h2>
          <p className="text-xs text-slate-400">
            Recent administration and recovery actions. Secrets are never stored.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No audit events recorded yet.</p>
      ) : (
        <ul className="max-h-[24rem] divide-y divide-white/8 overflow-y-auto">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{ACTION_LABELS[e.action] || e.action}</p>
                {e.detail && <p className="truncate text-xs text-slate-400">{e.detail}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
                <span className="font-mono">{e.actor || "—"}</span>
                {e.ip && <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono">{e.ip}</span>}
                <span>{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}