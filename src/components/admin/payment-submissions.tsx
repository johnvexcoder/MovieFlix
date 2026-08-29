"use client";

import { useEffect, useState } from "react";
import { Loader2, CreditCard, CheckCircle2, XCircle, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AdminPayment {
  id: string;
  accountId: string;
  accountUsername: string | null;
  methodName: string | null;
  senderName: string;
  senderAccountNumber: string;
  amount: number;
  referenceNumber: string;
  receiptUrl: string | null;
  adminNote: string | null;
  status: string;
  createdAt: string;
}

export function PaymentSubmissionsAdmin() {
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminPayment | null>(null);
  const [extendHours, setExtendHours] = useState<number>(720);

  async function load() {
    try {
      const res = await fetch("/api/admin/payments", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setItems(data.data.submissions);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/payments", { cache: "no-store" });
        const data = await res.json();
        if (data.success && mounted) setItems(data.data.submissions);
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function review(item: AdminPayment, status: "approved" | "rejected") {
    setActionId(item.id);
    try {
      const res = await fetch(`/api/admin/payments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          extendHours: status === "approved" ? extendHours : undefined,
        }),
      });
      const data = await res.json();
      alert(data.success ? data.data.message : data.error || "Action failed");
      if (data.success) {
        if (viewing?.id === item.id) setViewing(null);
        await load();
      }
    } catch {
      alert("Action failed");
    } finally {
      setActionId(null);
    }
  }

  const pending = items.filter((i) => i.status === "pending");

  return (
    <>
      <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Payment Submissions</h2>
            {pending.length > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                {pending.length} pending
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            Extend hours on approval
            <input
              type="number"
              min={1}
              value={extendHours}
              onChange={(e) => setExtendHours(parseInt(e.target.value) || 720)}
              className="h-8 w-24 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#e50914]/40"
            />
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
            <CreditCard className="mx-auto mb-2 h-8 w-8 text-neutral-600" />
            <p className="text-xs text-neutral-400">No payment submissions yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-white">
                      {item.senderName} · {item.methodName || "Unknown"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : item.status === "rejected"
                            ? "bg-red-500/15 text-red-400"
                            : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                    {item.accountUsername || "Unknown account"} · {item.amount.toFixed(2)} · Ref {item.referenceNumber} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5" onClick={() => setViewing(item)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {item.status !== "approved" && (
                    <Button
                      size="sm"
                      className="rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                      disabled={actionId === item.id}
                      onClick={() => review(item, "approved")}
                    >
                      {actionId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                  )}
                  {item.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      disabled={actionId === item.id}
                      onClick={() => review(item, "rejected")}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Payment Submission</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Account</p>
                  <p className="mt-0.5 font-semibold text-white">{viewing.accountUsername || "Unknown"}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Method</p>
                  <p className="mt-0.5 font-semibold text-white">{viewing.methodName || "Unknown"}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sender</p>
                  <p className="mt-0.5 font-semibold text-white">{viewing.senderName}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sender Account #</p>
                  <p className="mt-0.5 font-mono text-xs text-white">{viewing.senderAccountNumber}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Amount</p>
                  <p className="mt-0.5 font-bold text-white">{viewing.amount.toFixed(2)}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Reference</p>
                  <p className="mt-0.5 font-mono text-xs text-white">{viewing.referenceNumber}</p>
                </div>
              </div>

              {viewing.receiptUrl ? (
                <a
                  href={viewing.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Receipt
                </a>
              ) : (
                <p className="text-center text-xs text-neutral-500">No receipt uploaded.</p>
              )}

              {viewing.adminNote && viewing.status !== "pending" && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-neutral-300">
                  <p className="font-bold text-white">Note</p>
                  {viewing.adminNote}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setViewing(null)}>
                  Close
                </Button>
                {(viewing.status === "pending" || viewing.status === "rejected") && (
                  <Button className="btn-brand rounded-xl" onClick={() => review(viewing, "approved")} disabled={actionId === viewing.id}>
                    {actionId === viewing.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                    Approve
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}