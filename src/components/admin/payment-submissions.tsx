"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type AdminPayment = {
  id: string; username: string | null; email: string | null; planName: string;
  finalAmountMinor: number; discountAmountMinor: number; promoCode: string | null;
  provider: string; method: string; status: string; createdAt: string;
  providerPaymentId: string | null;
};
const money = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n / 100);

export function PaymentSubmissionsAdmin() {
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [configurationIssue, setConfigurationIssue] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/payments", { cache: "no-store" });
      const data = await response.json();
      if (data.success) { setItems(data.data.payments); setConfigurationIssue(data.data.configurationIssue || null); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);
  const shown = useMemo(() => items.filter((item) => `${item.username} ${item.email} ${item.planName} ${item.status} ${item.providerPaymentId} ${item.promoCode}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const reference = (item: AdminPayment) => item.providerPaymentId || (item.status === "PAID" && item.provider === "internal" ? "Internal promotion" : item.status === "PENDING" ? "Awaiting payment" : "—");

  return <section className="glass-panel min-w-0 rounded-3xl border border-white/10 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold"><CreditCard className="h-5 w-5 text-cyan-300"/>Automated payments</h2><p className="text-xs text-slate-400">Statuses refresh automatically. Access activates only through verified payment events.</p></div><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search payments" className="pl-9"/></div></div>
    {configurationIssue && <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200"><b>PayMongo configuration needs attention:</b> {configurationIssue}</div>}
    {loading ? <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-cyan-300"/> : <div className="mt-4 max-h-[480px] overflow-auto rounded-2xl border border-white/10"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 z-10 bg-[#0b1629]"><tr>{["Customer","Plan","Amount","Promo","Method","Status","Date","Reference"].map((label) => <th key={label} className="p-3 text-slate-400">{label}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{shown.map((item) => <tr key={item.id}><td className="p-3"><b>{item.username}</b><span className="block text-slate-500">{item.email}</span></td><td className="p-3">{item.planName}</td><td className="p-3"><b className="text-cyan-300">{money(item.finalAmountMinor)}</b>{item.discountAmountMinor > 0 && <span className="block text-emerald-300">−{money(item.discountAmountMinor)}</span>}</td><td className="p-3">{item.promoCode || "—"}</td><td className="p-3 uppercase">{item.provider} · {item.method}</td><td className="p-3 font-bold">{item.status}</td><td className="p-3">{new Date(item.createdAt).toLocaleString()}</td><td className="max-w-40 truncate p-3 font-mono" title={reference(item)}>{reference(item)}</td></tr>)}</tbody></table>{shown.length === 0 && <p className="p-8 text-center text-slate-500">No automated payments found.</p>}</div>}
  </section>;
}
