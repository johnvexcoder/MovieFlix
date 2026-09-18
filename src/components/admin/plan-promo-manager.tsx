"use client";
import { useEffect, useState } from "react";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
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

interface Plan {
  id: string;
  name: string;
  durationHours: number | null;
  isLifetime: boolean;
  price: number;
  discountAmount: number;
  discountUntil: string | null;
  discountActive: boolean;
  isActive: boolean;
}

interface Promo {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountAmount: number;
  percentOff: number;
  bonusHours: number;
  forcedPlanId: string | null;
  newUsersOnly: boolean;
  birthdayMonthOnly: boolean;
  maxUses: number | null;
  uses: number;
  reservedUses: number;
  perAccountLimit: number;
  minimumPurchaseMinor: number;
  maximumDiscountMinor: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

interface PlanForm {
  name: string;
  durationHours: string;
  price: string;
  discountAmount: string;
  discountUntil: string;
  isLifetime: boolean;
}

interface PromoForm {
  code: string;
  description: string;
  discountType: string;
  discountAmount: string;
  percentOff: string;
  bonusHours: string;
  forcedPlanId: string;
  newUsersOnly: boolean;
  birthdayMonthOnly: boolean;
  maxUses: string;
  perAccountLimit: string;
  minimumPurchase: string;
  maximumDiscount: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const toIso = (value: string) => (value ? new Date(value).toISOString() : null);
const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const blankPlan: PlanForm = { name: "", durationHours: "168", price: "", discountAmount: "0", discountUntil: "", isLifetime: false };
const blankPromo: PromoForm = {
  code: "", description: "", discountType: "fixed", discountAmount: "0", percentOff: "0", bonusHours: "0",
  forcedPlanId: "", newUsersOnly: false, birthdayMonthOnly: false, maxUses: "", perAccountLimit: "1",
  minimumPurchase: "0", maximumDiscount: "", startsAt: "", expiresAt: "", isActive: true,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="min-w-0">
      <Label className="mb-1.5 block text-xs text-slate-400">{label}</Label>
      {children}
    </label>
  );
}

const inputClass = "h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/40";
const selectClass = "h-10 w-full rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-white focus:outline-none";

export function PlanPromoManager() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [plan, setPlan] = useState<PlanForm>(blankPlan);
  const [promo, setPromo] = useState<PromoForm>(blankPromo);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const r = await fetch("/api/admin/promos", { cache: "no-store" });
    const d = await r.json();
    if (d.success) {
      setPlans(d.data.plans);
      setPromos(d.data.promos);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  function openAddPlan() {
    setEditingPlanId(null);
    setPlan(blankPlan);
    setError("");
    setPlanModalOpen(true);
  }

  function openEditPlan(p: Plan) {
    setEditingPlanId(p.id);
    setPlan({
      name: p.name,
      durationHours: String(p.durationHours || 168),
      price: String(p.price),
      discountAmount: String(p.discountAmount),
      discountUntil: toLocalInput(p.discountUntil),
      isLifetime: p.isLifetime,
    });
    setError("");
    setPlanModalOpen(true);
  }

  function openAddPromo() {
    setEditingPromoId(null);
    setPromo(blankPromo);
    setError("");
    setPromoModalOpen(true);
  }

  function openEditPromo(p: Promo) {
    setEditingPromoId(p.id);
    setPromo({
      code: p.code,
      description: p.description || "",
      discountType: p.discountType,
      discountAmount: String(p.discountAmount),
      percentOff: String(p.percentOff),
      bonusHours: String(p.bonusHours),
      forcedPlanId: p.forcedPlanId || "",
      newUsersOnly: p.newUsersOnly,
      birthdayMonthOnly: p.birthdayMonthOnly,
      maxUses: p.maxUses ? String(p.maxUses) : "",
      perAccountLimit: String(p.perAccountLimit),
      minimumPurchase: String(p.minimumPurchaseMinor / 100),
      maximumDiscount: p.maximumDiscountMinor ? String(p.maximumDiscountMinor / 100) : "",
      startsAt: toLocalInput(p.startsAt),
      expiresAt: toLocalInput(p.expiresAt),
      isActive: p.isActive,
    });
    setError("");
    setPromoModalOpen(true);
  }

  async function savePlan() {
    const r = await fetch("/api/admin/plans", {
      method: editingPlanId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...plan,
        id: editingPlanId,
        price: Number(plan.price),
        discountAmount: Number(plan.discountAmount),
        durationHours: Number(plan.durationHours),
        discountUntil: toIso(plan.discountUntil),
      }),
    });
    const d = await r.json();
    if (!d.success) return setError(d.error);
    setEditingPlanId(null);
    setPlan(blankPlan);
    setPlanModalOpen(false);
    await load();
  }

  async function savePromo() {
    const r = await fetch("/api/admin/promos", {
      method: editingPromoId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...promo,
        id: editingPromoId,
        discountAmount: Number(promo.discountAmount),
        percentOff: Number(promo.percentOff),
        bonusHours: Number(promo.bonusHours),
        maxUses: promo.maxUses ? Number(promo.maxUses) : null,
        perAccountLimit: Number(promo.perAccountLimit),
        minimumPurchase: Number(promo.minimumPurchase),
        maximumDiscount: promo.maximumDiscount ? Number(promo.maximumDiscount) : null,
        startsAt: toIso(promo.startsAt),
        expiresAt: toIso(promo.expiresAt),
      }),
    });
    const d = await r.json();
    if (!d.success) return setError(d.error);
    setEditingPromoId(null);
    setPromo(blankPromo);
    setPromoModalOpen(false);
    await load();
  }

  async function archive(kind: "plans" | "promos", id: string) {
    if (!confirm(`Archive this ${kind === "plans" ? "plan" : "promotion"}? Historical payments will remain.`)) return;
    await fetch(`/api/admin/${kind}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  async function enablePromo(id: string) {
    const r = await fetch("/api/admin/promos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "enable" }),
    });
    const d = await r.json();
    if (!d.success) return setError(d.error);
    await load();
  }

  async function removePromo(id: string) {
    if (!confirm("Delete this unused promotion permanently? Promotions tied to payments must be kept for history.")) return;
    const r = await fetch(`/api/admin/promos?id=${encodeURIComponent(id)}&remove=1`, { method: "DELETE" });
    const d = await r.json();
    if (!d.success) return setError(d.error);
    await load();
  }

  return (
    <div className="space-y-5">
      {/* ===== Subscription plans ===== */}
      <section className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">
            <div>
              <h2 className="text-xl font-bold">Subscription plans</h2>
              <p className="text-xs text-slate-400">Plans and pricing for memberships.</p>
            </div>
          </div>
          <Button onClick={openAddPlan} className="btn-brand rounded-xl text-xs font-bold">
            <Plus className="mr-1.5 h-4 w-4" /> Add Plan
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <article key={p.id} className={`rounded-2xl border p-4 ${p.isActive ? "border-white/10 bg-white/5" : "border-white/5 bg-black/20 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <b className="text-white">{p.name}</b>
                <span className="flex shrink-0 gap-1.5">
                  <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:bg-white/15" title="Edit plan" aria-label="Edit plan" onClick={() => openEditPlan(p)}><Pencil className="h-4 w-4 text-cyan-300" /></button>
                  {p.isActive && (
                    <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:bg-white/15" title="Archive plan" aria-label="Archive plan" onClick={() => archive("plans", p.id)}><Trash2 className="h-4 w-4 text-orange-300" /></button>
                  )}
                </span>
              </div>
              <p className="mt-2 text-cyan-300">₱{Math.max(0, p.price - (p.discountActive ? p.discountAmount : 0)).toFixed(2)}</p>
              {p.discountActive && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-orange-400/15 px-2 py-0.5 text-[10px] font-black text-orange-200">{p.price > 0 ? Math.round((p.discountAmount / p.price) * 100) : 0}% OFF</span>
                  <span className="text-[10px] text-slate-500 line-through">₱{p.price.toFixed(2)}</span>
                  {p.discountUntil && <span className="text-[10px] text-slate-400">until {new Date(p.discountUntil).toLocaleString()}</span>}
                </div>
              )}
              <small className="text-slate-400">{p.isLifetime ? "Lifetime" : `${p.durationHours} hours`} · {p.isActive ? "Active" : "Archived"}</small>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Promo & redeem codes ===== */}
      <section className="admin-card">
        <div className="admin-card-header">
          <div className="admin-card-title">
            <div>
              <h2 className="text-xl font-bold">Promo &amp; redeem codes</h2>
              <p className="text-xs text-slate-400">Usage is committed only after PayMongo confirms payment. Abandoned QR codes release their reservation.</p>
            </div>
          </div>
          <Button onClick={openAddPromo} className="btn-brand rounded-xl text-xs font-bold">
            <Plus className="mr-1.5 h-4 w-4" /> Create Promotion
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {promos.map((p) => (
            <article key={p.id} className={`rounded-2xl border p-4 ${p.isActive ? "border-white/10 bg-white/5" : "border-white/5 bg-black/20 opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <b className="font-mono text-cyan-300">{p.code}</b>
                  <p className="text-xs text-slate-400">{p.discountType === "percent" ? `${p.percentOff}% off` : `₱${p.discountAmount.toFixed(2)} off`} · {p.uses}/{p.maxUses ?? "∞"} paid · {p.reservedUses} reserved by unpaid QR</p>
                </div>
                <span className="flex shrink-0 gap-1.5">
                  <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:bg-white/15" title="Edit promotion" aria-label="Edit promotion" onClick={() => openEditPromo(p)}><Pencil className="h-4 w-4 text-cyan-300" /></button>
                  {p.isActive ? (
                    <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:bg-white/15" title="Disable promotion" aria-label={`Disable ${p.code}`} onClick={() => archive("promos", p.id)}><Power className="h-4 w-4 text-orange-300" /></button>
                  ) : (
                    <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:bg-white/15" title="Enable promotion" aria-label={`Enable ${p.code}`} onClick={() => enablePromo(p.id)}><Power className="h-4 w-4 text-emerald-300" /></button>
                  )}
                  <button className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-colors hover:bg-white/15" title="Delete promotion" aria-label={`Delete ${p.code}`} onClick={() => removePromo(p.id)}><Trash2 className="h-4 w-4 text-red-300" /></button>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Add / Edit Plan modal ===== */}
      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="glass-panel max-h-[90dvh] overflow-y-auto border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">{editingPlanId ? "Edit plan" : "Add plan"}</DialogTitle>
            <DialogDescription className="text-neutral-400">Configure a subscription plan.</DialogDescription>
          </DialogHeader>
          <div className="admin-form-row">
            <Field label="Name"><Input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} className={inputClass} /></Field>
            <Field label="Duration hours"><Input type="number" disabled={plan.isLifetime} value={plan.durationHours} onChange={(e) => setPlan({ ...plan, durationHours: e.target.value })} className={inputClass} /></Field>
            <Field label="Price (PHP)"><Input type="number" step="0.01" value={plan.price} onChange={(e) => setPlan({ ...plan, price: e.target.value })} className={inputClass} /></Field>
            <Field label="Plan discount (PHP)"><Input type="number" step="0.01" value={plan.discountAmount} onChange={(e) => setPlan({ ...plan, discountAmount: e.target.value })} className={inputClass} /></Field>
            <Field label="Discount until"><Input type="datetime-local" value={plan.discountUntil} onChange={(e) => setPlan({ ...plan, discountUntil: e.target.value })} className={inputClass} /></Field>
            <label className="flex items-center gap-2 pt-6 text-sm text-white"><input type="checkbox" checked={plan.isLifetime} onChange={(e) => setPlan({ ...plan, isLifetime: e.target.checked })} className="h-4 w-4" /> Lifetime access</label>
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setPlanModalOpen(false)}>Cancel</Button>
            <Button onClick={savePlan} className="btn-brand rounded-xl"><Plus className="mr-2 h-4 w-4" />{editingPlanId ? "Save plan" : "Add plan"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Create / Edit Promotion modal ===== */}
      <Dialog open={promoModalOpen} onOpenChange={setPromoModalOpen}>
        <DialogContent className="glass-panel max-h-[90dvh] overflow-y-auto border-white/15 sm:max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">{editingPromoId ? "Edit promotion" : "Create promotion"}</DialogTitle>
            <DialogDescription className="text-neutral-400">Configure a promo or redeem code.</DialogDescription>
          </DialogHeader>
          <div className="admin-form-row">
            <Field label="Code"><Input autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={promo.code} onChange={(e) => setPromo({ ...promo, code: e.target.value.toUpperCase() })} className={inputClass} /></Field>
            <Field label="Description"><Input value={promo.description} onChange={(e) => setPromo({ ...promo, description: e.target.value })} className={inputClass} /></Field>
            <Field label="Eligible plan">
              <select className={selectClass} value={promo.forcedPlanId} onChange={(e) => setPromo({ ...promo, forcedPlanId: e.target.value })}>
                <option value="">All plans</option>
                {plans.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Discount type">
              <select className={selectClass} value={promo.discountType} onChange={(e) => setPromo({ ...promo, discountType: e.target.value })}>
                <option value="fixed">Fixed PHP</option>
                <option value="percent">Percentage</option>
              </select>
            </Field>
            {promo.discountType === "fixed" ? (
              <Field label="Discount (PHP)"><Input type="number" step="0.01" value={promo.discountAmount} onChange={(e) => setPromo({ ...promo, discountAmount: e.target.value })} className={inputClass} /></Field>
            ) : (
              <Field label="Discount percent"><Input type="number" min="0" max="100" value={promo.percentOff} onChange={(e) => setPromo({ ...promo, percentOff: e.target.value })} className={inputClass} /></Field>
            )}
            <Field label="Maximum discount (PHP)"><Input type="number" step="0.01" value={promo.maximumDiscount} onChange={(e) => setPromo({ ...promo, maximumDiscount: e.target.value })} className={inputClass} /></Field>
            <Field label="Minimum purchase (PHP)"><Input type="number" step="0.01" value={promo.minimumPurchase} onChange={(e) => setPromo({ ...promo, minimumPurchase: e.target.value })} className={inputClass} /></Field>
            <Field label="Global paid uses"><Input type="number" value={promo.maxUses} onChange={(e) => setPromo({ ...promo, maxUses: e.target.value })} className={inputClass} /></Field>
            <Field label="Uses per account"><Input type="number" min="1" value={promo.perAccountLimit} onChange={(e) => setPromo({ ...promo, perAccountLimit: e.target.value })} className={inputClass} /></Field>
            <Field label="Bonus hours"><Input type="number" value={promo.bonusHours} onChange={(e) => setPromo({ ...promo, bonusHours: e.target.value })} className={inputClass} /></Field>
            <Field label="Starts"><Input type="datetime-local" value={promo.startsAt} onChange={(e) => setPromo({ ...promo, startsAt: e.target.value })} className={inputClass} /></Field>
            <Field label="Expires"><Input type="datetime-local" value={promo.expiresAt} onChange={(e) => setPromo({ ...promo, expiresAt: e.target.value })} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={promo.newUsersOnly} onChange={(e) => setPromo({ ...promo, newUsersOnly: e.target.checked })} className="h-4 w-4" /> New customers only</label>
            <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={promo.birthdayMonthOnly} onChange={(e) => setPromo({ ...promo, birthdayMonthOnly: e.target.checked })} className="h-4 w-4" /> Birth month only</label>
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setPromoModalOpen(false)}>Cancel</Button>
            <Button onClick={savePromo} className="btn-brand rounded-xl"><Plus className="mr-2 h-4 w-4" />{editingPromoId ? "Save promotion" : "Create promotion"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}