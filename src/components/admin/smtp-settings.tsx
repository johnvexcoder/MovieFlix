"use client";
import { useEffect, useState } from "react";
import { Database, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SmtpSettings() {
  const [appPublicUrl, setAppPublicUrl] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.settings) {
          const s = d.data.settings;
          if (s.smtp_host) setHost(s.smtp_host);
          if (s.smtp_port) setPort(s.smtp_port);
          if (s.smtp_user) setUser(s.smtp_user);
          if (s.smtp_from) setFrom(s.smtp_from);
          setPass(s.smtp_pass_set === "true" ? "••••••••••" : "");
          if (s.app_public_url) setAppPublicUrl(s.app_public_url);
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const passToSend = pass === "••••••••••" ? "" : pass;
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            smtp_host: host,
            smtp_port: port,
            smtp_user: user,
            smtp_pass: passToSend,
            smtp_from: from,
            app_public_url: appPublicUrl,
          },
        }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setMessage("SMTP settings saved.");
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
          <Database className="h-5 w-5 text-blue-400" />
          <div>
            <h2>SMTP email settings</h2>
            <p>Outgoing mail for recovery codes, reminders, and broadcasts.</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="btn-brand rounded-xl text-xs font-bold">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save
        </Button>
      </div>
      <div className="admin-stack">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Public URL (links inside emails)</Label>
          <Input value={appPublicUrl} onChange={(e) => setAppPublicUrl(e.target.value)} placeholder="https://movieflix.example.com" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 font-mono text-white" />
          <p className="mt-1 text-[11px] text-neutral-400">Base URL used for login and reset links in emails.</p>
        </div>
        <div className="admin-form-row">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">SMTP host</Label>
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">SMTP port</Label>
            <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Sender email (From)</Label>
            <Input type="email" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="noreply@movieflix.local" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">SMTP username</Label>
            <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Username" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">SMTP password</Label>
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white" />
          </div>
        </div>
      </div>
      {message && <p className="mt-3 text-sm text-cyan-200">{message}</p>}
    </section>
  );
}