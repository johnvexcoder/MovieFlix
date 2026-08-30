"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, CreditCard, Image as ImageIcon, Save } from "lucide-react";
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

interface PaymentMethod {
  id: string;
  name: string;
  accountNumber: string;
  iconPath: string | null;
  qrPath: string | null;
  isActive: boolean;
  sortOrder: number;
}

const FILE_PICKER_BASE = "/api/files?file=";

// Method icon with a graceful fallback: if the stored image fails to load
// (deleted file, revoked access, broken record), show a tidy letter tile
// instead of the browser's broken-image glyph.
function MethodIcon({ name, iconPath }: { name: string; iconPath: string | null }) {
  const [failed, setFailed] = useState(false);
  const tile = (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-sm font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
  if (!iconPath || failed) return tile;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={FILE_PICKER_BASE + encodeURIComponent(iconPath)}
      alt={name}
      onError={() => setFailed(true)}
      className="h-10 w-10 rounded-xl bg-white/10 object-contain"
    />
  );
}

export function PaymentMethodsManager() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [formName, setFormName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formIconUrl, setFormIconUrl] = useState("");
  const [formQrUrl, setFormQrUrl] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function loadMethods() {
    try {
      const res = await fetch("/api/admin/payment-methods");
      const data = await res.json();
      if (data.success) setMethods(data.data.methods);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/payment-methods");
        const data = await res.json();
        if (data.success && mounted) setMethods(data.data.methods);
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, kind: "icon" | "qr") {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        const url = data.data.url;
        if (kind === "icon") setFormIconUrl(url);
        else setFormQrUrl(url);
      } else {
        setFormError(data.error || "Upload failed");
      }
    } catch {
      setFormError("Upload failed");
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  }

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormAccountNumber("");
    setFormIconUrl("");
    setFormQrUrl("");
    setFormActive(true);
    setFormError(null);
    setEditOpen(true);
  }

  function openEdit(m: PaymentMethod) {
    setEditing(m);
    setFormName(m.name);
    setFormAccountNumber(m.accountNumber);
    setFormIconUrl(m.iconPath ? FILE_PICKER_BASE + encodeURIComponent(m.iconPath) : "");
    setFormQrUrl(m.qrPath ? FILE_PICKER_BASE + encodeURIComponent(m.qrPath) : "");
    setFormActive(m.isActive);
    setFormError(null);
    setEditOpen(true);
  }

  function iconPathFromUrl(url: string): string | null {
    if (!url) return null;
    const m = url.match(/file=([^&]+)/);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    const payload = {
      id: editing?.id,
      name: formName,
      accountNumber: formAccountNumber,
      iconPath: iconPathFromUrl(formIconUrl),
      qrPath: iconPathFromUrl(formQrUrl),
      isActive: formActive,
    };
    try {
      const res = await fetch("/api/admin/payment-methods", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setEditOpen(false);
        await loadMethods();
      } else {
        setFormError(data.error || "Failed to save");
      }
    } catch {
      setFormError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment method?")) return;
    try {
      const res = await fetch(`/api/admin/payment-methods?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) await loadMethods();
      else alert(data.error || "Failed to delete");
    } catch {
      alert("Failed to delete");
    }
  }

  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CreditCard className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Payment Methods</h2>
        </div>
        <Button size="sm" onClick={openCreate} className="btn-brand h-9 rounded-xl text-xs font-bold">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Method
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        </div>
      ) : methods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
          <CreditCard className="mx-auto mb-2 h-8 w-8 text-neutral-600" />
          <p className="text-xs text-neutral-400">
            No payment methods yet. Add one so subscribers can renew their accounts.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {methods.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <MethodIcon name={m.name} iconPath={m.iconPath} />
                <div>
                  <p className="text-sm font-bold text-white">{m.name}</p>
                  <p className="text-[11px] font-mono text-neutral-400">{m.accountNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-neutral-500"}`}>
                  {m.isActive ? "Active" : "Hidden"}
                </span>
                <Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5" onClick={() => openEdit(m)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="destructive" size="sm" className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" onClick={() => handleDelete(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => !open && setEditOpen(false)}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              {editing ? "Edit Payment Method" : "Add Payment Method"}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Subscribers will see this method when they choose to renew their account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Method Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. M-Pesa"
                  className="mt-1.5 h-10 rounded-xl border-white/10 bg-white/5 text-white"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Account Number</Label>
                <Input
                  value={formAccountNumber}
                  onChange={(e) => setFormAccountNumber(e.target.value)}
                  placeholder="e.g. 0722 000 000"
                  className="mt-1.5 h-10 rounded-xl border-white/10 bg-white/5 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Icon upload */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Icon Image</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  {formIconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={formIconUrl} alt="icon" className="h-11 w-11 rounded-xl bg-white/10 object-contain" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-neutral-500">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <label className="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">
                    {uploading === "icon" ? "Uploading…" : "Upload Icon"}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => handleFileUpload(e, "icon")} />
                  </label>
                  {formIconUrl && (
                    <button type="button" className="text-xs text-neutral-500 hover:text-white" onClick={() => setFormIconUrl("")}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* QR upload */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">QR Code Image</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  {formQrUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={formQrUrl} alt="QR" className="h-11 w-11 rounded-xl bg-white/10 object-contain" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-neutral-500">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <label className="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">
                    {uploading === "qr" ? "Uploading…" : "Upload QR"}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => handleFileUpload(e, "qr")} />
                  </label>
                  {formQrUrl && (
                    <button type="button" className="text-xs text-neutral-500 hover:text-white" onClick={() => setFormQrUrl("")}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-semibold text-neutral-200">
              <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/5 accent-emerald-500" />
              Visible to subscribers
            </label>

            {formError && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 font-medium">
                {formError}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-brand rounded-xl" onClick={handleSave} disabled={saving || !formName.trim() || !formAccountNumber.trim()}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {editing ? "Save Changes" : "Add Method"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}