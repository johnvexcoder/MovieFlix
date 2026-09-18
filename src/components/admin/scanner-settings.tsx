"use client";
import { useEffect, useState } from "react";
import { Database, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ScannerSettings() {
  const [intervalMinutes, setIntervalMinutes] = useState(10);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.settings?.scan_interval) {
          setIntervalMinutes(parseInt(d.data.settings.scan_interval) || 10);
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { scan_interval: String(intervalMinutes) } }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setMessage("Scanner interval saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-title">
          <Database className="h-5 w-5 text-purple-400" />
          <div>
            <h2>Filesystem scanner</h2>
            <p>How often to automatically check configured library folders.</p>
          </div>
        </div>
      </div>
      <div className="admin-form-row">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Periodic interval (minutes)</Label>
          <Input type="number" min={1} max={1440} value={intervalMinutes} onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 10)} className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="btn-brand rounded-xl text-xs font-bold">{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save</Button>
        {message && <span className="text-sm text-cyan-200">{message}</span>}
      </div>
    </section>
  );
}