"use client";

import { useState, useEffect } from "react";
import { Loader2, Copy, Check, QrCode, Upload, CreditCard, CheckCircle2, Clock, XCircle, X } from "lucide-react";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PaymentMethod {
  id: string;
  name: string;
  accountNumber: string;
  iconUrl: string | null;
  qrUrl: string | null;
}

interface MySubmission {
  id: string;
  senderName: string;
  amount: number;
  referenceNumber: string;
  status: string;
  createdAt: string;
}

export default function UpdatePaymentPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [mRes, sRes] = await Promise.all([
          fetch("/api/payment-methods", { cache: "no-store" }),
          fetch("/api/payments", { cache: "no-store" }),
        ]);
        const mData = await mRes.json();
        const sData = await sRes.json();
        if (mData.success) setMethods(mData.data.methods);
        if (sData.success) setSubmissions(sData.data.submissions);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function copyAccountNumber() {
    if (!selectedMethod) return;
    navigator.clipboard?.writeText(selectedMethod.accountNumber).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setReceiptUrl(data.data.url);
      else setError(data.error || "Receipt upload failed");
    } catch {
      setError("Receipt upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit() {
    if (!selectedMethod) return;
    if (!name.trim() || !accountNumber.trim() || !amount || !reference.trim() || !receiptUrl) {
      setError("Please fill in all fields and upload your payment receipt.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethodId: selectedMethod.id,
          senderName: name.trim(),
          senderAccountNumber: accountNumber.trim(),
          amount: Number(amount),
          referenceNumber: reference.trim(),
          receiptPath: decodeURIComponent(receiptUrl.split("file=")[1] || ""),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedMethod(null);
        setSuccess(true);
        setName("");
        setAccountNumber("");
        setAmount("");
        setReference("");
        setReceiptUrl("");
        const sRes = await fetch("/api/payments", { cache: "no-store" });
        const sData = await sRes.json();
        if (sData.success) setSubmissions(sData.data.submissions);
      } else {
        setError(data.error || "Failed to submit payment. Please try again.");
      }
    } catch {
      setError("Failed to submit payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709]">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  return (
    <AccountSettingsShell heading="Payment / Renew" subheading="Renew your subscription by choosing a payment method below. Payments are normally processed within 2 hours.">
      {methods.length === 0 ? (
        <div className="glass-panel rounded-3xl border border-white/10 p-10 text-center">
          <CreditCard className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
          <h2 className="text-lg font-bold text-white">No payment methods available</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Payment options are currently unavailable. Please check back later or contact support.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMethod(m);
                  setCopied(false);
                  setError(null);
                }}
                className="glass-panel flex items-center gap-4 rounded-3xl border border-white/10 p-5 text-left transition-all hover:border-emerald-500/40 hover:bg-white/10"
              >
                {m.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.iconUrl} alt={m.name} className="h-14 w-14 rounded-2xl bg-white/10 object-contain" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-lg font-bold text-white">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-base font-bold text-white">{m.name}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-neutral-400">{m.accountNumber}</p>
                  <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    Tap to pay
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="glass-panel mt-6 rounded-3xl border border-white/10 p-6">
            <h2 className="text-base font-bold text-white">Your Recent Payments</h2>
            {submissions.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-400">You haven&apos;t submitted any payments yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {submissions.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-xs font-bold text-white">{s.senderName}</p>
                      <p className="text-[11px] text-neutral-400">
                        {new Date(s.createdAt).toLocaleString()} · Ref {s.referenceNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold tabular-nums text-white">{s.amount.toFixed(2)}</p>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          s.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : s.status === "rejected"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-amber-500/15 text-amber-400"
                        }`}
                      >
                        {s.status === "approved" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : s.status === "rejected" ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Method payment modal */}
      <AnimatePresence>
        {selectedMethod && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-sm"
            onClick={() => setSelectedMethod(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[90vw] max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#141416] p-4 sm:p-6 shadow-2xl"
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedMethod(null)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                {selectedMethod.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedMethod.iconUrl} alt={selectedMethod.name} className="h-12 w-12 rounded-2xl bg-white/10 object-contain" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 text-lg font-bold text-white">
                    {selectedMethod.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-white">Pay with {selectedMethod.name}</h2>
                  <p className="text-xs text-neutral-400">Complete your payment to renew your subscription.</p>
                </div>
              </div>

              {selectedMethod.qrUrl && (
                <div className="mt-5 flex flex-col items-center rounded-2xl border border-white/10 bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedMethod.qrUrl} alt={`${selectedMethod.name} QR code`} className="h-48 w-48 object-contain" />
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600">
                    <QrCode className="h-3.5 w-3.5" />
                    Scan with your {selectedMethod.name} app
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Pay To Account</p>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <p className="font-mono text-lg font-bold text-white">{selectedMethod.accountNumber}</p>
                  <Button variant="outline" size="sm" className="h-9 rounded-xl border-white/15 bg-white/5" onClick={copyAccountNumber}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="ml-1 text-xs">{copied ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Sender Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" className="mt-0 h-10 rounded-xl border-white/10 bg-white/5 text-white" />

                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Your Account Number</Label>
                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account you paid from" className="mt-0 h-10 rounded-xl border-white/10 bg-white/5 text-white font-mono" />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Amount</Label>
                    <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="mt-0 h-10 rounded-xl border-white/10 bg-white/5 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Reference Number</Label>
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction ref" className="mt-0 h-10 rounded-xl border-white/10 bg-white/5 text-white font-mono" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Upload Payment Receipt</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    {receiptUrl ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Receipt uploaded
                      </div>
                    ) : (
                      <label className="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">
                        {uploading ? "Uploading…" : "Upload Receipt"}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleReceiptUpload} />
                      </label>
                    )}
                    {receiptUrl && (
                      <button type="button" className="text-xs text-neutral-500 hover:text-white" onClick={() => setReceiptUrl("")}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs font-medium text-red-300">
                    {error}
                  </div>
                )}

                <Button
                  className="btn-brand h-12 w-full rounded-xl text-sm font-bold"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  I Have Paid — Submit
                </Button>
                <p className="text-center text-[11px] text-neutral-500">
                  Your submission will be reviewed by our team, usually within 2 hours.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success dialog */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-[90vw] rounded-3xl border border-emerald-500/30 bg-[#141416] p-4 sm:p-6 text-center shadow-2xl"
            >
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-white">Payment Submitted</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                Your payment has been received. Your account will normally be renewed within 2 hours. You can check
                the status of your payment anytime on this page.
              </p>
              <Button className="btn-brand mt-5 w-full rounded-xl" onClick={() => setSuccess(false)}>
                Done
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AccountSettingsShell>
  );
}