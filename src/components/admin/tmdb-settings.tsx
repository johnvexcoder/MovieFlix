"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Key, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TmdbSettings() {
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.settings) {
          const s = d.data.settings;
          setKeySet(s.tmdb_api_key_set === "true");
          setApiKey(s.tmdb_api_key_set === "true" ? "••••••••••" : "");
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const valueToSend = apiKey === "••••••••••" ? "" : apiKey;
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { tmdb_api_key: valueToSend } }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setKeySet(true);
      setMessage("TMDB API key saved.");
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
          <Key className="h-5 w-5 text-[var(--brand)]" />
          <div>
            <h2>TMDB metadata integration</h2>
            <p>Used to fetch artwork, backdrops, summaries, and episode stills.</p>
          </div>
        </div>
        <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline">
          <span>Get API key</span> <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="admin-form-row">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">TMDB API key (v3 auth)</Label>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={keySet ? "•••••••••• (saved)" : "Enter 32-character TMDB API key"} className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 font-mono text-white" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="btn-brand rounded-xl text-xs font-bold">{saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save</Button>
        {message && <span className="text-sm text-cyan-200">{message}</span>}
      </div>
    </section>
  );
}