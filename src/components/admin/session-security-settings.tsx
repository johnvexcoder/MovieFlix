"use client";
import { useEffect, useState } from "react";
import { Loader2, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SessionSecuritySettings() {
  const [maxSessions, setMaxSessions] = useState(3);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.settings) {
          const s = d.data.settings;
          if (s.max_sessions) setMaxSessions(parseInt(s.max_sessions));
          if (s.session_timeout) setSessionTimeout(parseInt(s.session_timeout));
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
        body: JSON.stringify({ settings: { max_sessions: String(maxSessions), session_timeout: String(sessionTimeout) } }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setMessage("Delivery / session settings saved.");
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
          <Shield className="h-5 w-5 text-emerald-400" />
          <div>
            <h2>Streaming &amp; session limits</h2>
            <p>Concurrent streams per account and session idle timeout.</p>
          </div>
        </div>
      </div>
      <div className="admin-form-row">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Max concurrent streams</Label>
          <Input type="number" min={1} max={10} value={maxSessions} onChange={(e) => setMaxSessions(parseInt(e.target.value) || 3)} className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
          <p className="mt-1 text-[11px] text-neutral-400">Maximum simultaneous streams permitted per account.</p>
        </div>
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Session idle timeout (minutes)</Label>
          <Input type="number" min={5} max={1440} value={sessionTimeout} onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 30)} className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
          <p className="mt-1 text-[11px] text-neutral-400">Automatically log out sessions inactive for this long.</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="btn-brand rounded-xl text-xs font-bold">{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save</Button>
        {message && <span className="text-sm text-cyan-200">{message}</span>}
      </div>
    </section>
  );
}