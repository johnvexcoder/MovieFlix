"use client";
import { useEffect, useState } from "react";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TelegramSettings() {
  const [botToken, setBotToken] = useState("");
  const [botTokenSet, setBotTokenSet] = useState(false);
  const [adminChatId, setAdminChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.settings) {
          const s = d.data.settings;
          setBotTokenSet(s.telegram_bot_token_set === "true");
          setBotToken(s.telegram_bot_token_set === "true" ? "••••••••••" : "");
          if (s.telegram_admin_chat_id) setAdminChatId(s.telegram_admin_chat_id);
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const tokenToSend = botToken === "••••••••••" ? "" : botToken;
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { telegram_bot_token: tokenToSend, telegram_admin_chat_id: adminChatId.trim() } }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setBotTokenSet(true);
      setMessage({ ok: true, text: "Telegram configuration saved." });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/settings/telegram-test", { method: "POST" });
      const d = await r.json();
      setMessage(d.success ? { ok: true, text: d.message } : { ok: false, text: d.error || "Test failed" });
    } catch {
      setMessage({ ok: false, text: "Could not test Telegram" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-title">
          <Send className="h-5 w-5 text-cyan-300" />
          <div>
            <h2>Telegram Admin Assistant</h2>
            <p>Recovery codes are sent to the Main Admin via this bot. Secrets stay server-side.</p>
          </div>
        </div>
      </div>
      <div className="admin-form-row">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Bot token</Label>
          <Input type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder={botTokenSet ? "•••••••••• (saved)" : "123456:ABC-DEF...bot token"} className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 font-mono text-white" />
          <p className="mt-1 text-[11px] text-neutral-400">Created with <a className="text-cyan-300 underline" href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a>. Never shown to the browser.</p>
        </div>
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Main Admin chat ID</Label>
          <Input value={adminChatId} onChange={(e) => setAdminChatId(e.target.value)} placeholder="e.g. 123456789 or -100123456789" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 font-mono text-white" />
          <p className="mt-1 text-[11px] text-neutral-400">Find it with <a className="text-cyan-300 underline" href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer">@userinfobot</a>. Supports positive and negative (group/channel) IDs.</p>
        </div>
      </div>
      <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-950/30 p-3 text-[11px] text-slate-300">
        Start a conversation with your Telegram bot before testing — open the bot and press <b>Start</b> or send <code>/start</code>. Otherwise Telegram may reject the message.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={save} disabled={saving} className="btn-brand rounded-xl text-xs font-bold">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Save Configuration
        </Button>
        <Button onClick={test} disabled={testing} variant="outline" className="rounded-xl border-white/15 bg-white/5 text-xs font-bold hover:bg-white/15">
          {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />} Test Telegram
        </Button>
      </div>
      {message && (
        <p className={`mt-3 rounded-xl border p-3 text-xs font-semibold ${message.ok ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400" : "border-red-400/30 bg-red-950/40 text-red-200"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}