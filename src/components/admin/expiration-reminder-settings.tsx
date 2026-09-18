"use client";
import { useEffect, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ExpirationReminderSettings() {
  const [reminderDays, setReminderDays] = useState(3);
  const [reminderMessage, setReminderMessage] = useState(
    "Your subscription is expiring soon. Please renew your account to continue watching.",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.settings) {
          const s = d.data.settings;
          if (s.reminder_days) setReminderDays(parseInt(s.reminder_days));
          if (s.reminder_message) setReminderMessage(s.reminder_message);
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
        body: JSON.stringify({
          settings: {
            reminder_days: String(reminderDays),
            reminder_message: reminderMessage,
          },
        }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setMessage("Expiration reminder settings saved.");
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
          <Sparkles className="h-5 w-5 text-amber-400" />
          <div>
            <h2>Expiration reminder</h2>
            <p>Email reminders sent to members before their plan expires.</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="btn-brand rounded-xl text-xs font-bold">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save
        </Button>
      </div>
      <div className="admin-form-row">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Remind before (days)</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={reminderDays}
            onChange={(e) => setReminderDays(parseInt(e.target.value) || 3)}
            className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
          />
          <p className="mt-1 text-[11px] text-neutral-400">How many days before expiration to email the member.</p>
        </div>
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Custom reminder message</Label>
          <textarea
            value={reminderMessage}
            onChange={(e) => setReminderMessage(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
          />
        </div>
      </div>
      {message && <p className="mt-3 text-sm text-cyan-200">{message}</p>}
    </section>
  );
}