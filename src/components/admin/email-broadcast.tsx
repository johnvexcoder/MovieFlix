"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, Users, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Account {
  id: string;
  username: string;
  email: string | null;
}

export function EmailBroadcastAdmin() {
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [recipientMode, setRecipientMode] = useState<"all" | "single">("all");
  const [singleAccountId, setSingleAccountId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/accounts", { cache: "no-store" });
        const data = await res.json();
        if (data.success && mounted) {
          const list = (data.data.accounts || []).filter((a: Account) => a.email);
          setAllAccounts(list);
        }
      } catch {
      } finally {
        if (mounted) setAccountsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSend() {
    if (sending) return;
    if (!subject.trim() || !message.trim()) {
      setResult({ ok: false, text: "Please provide both a subject and a message." });
      return;
    }
    if (recipientMode === "single" && !singleAccountId) {
      setResult({ ok: false, text: "Please select a specific user." });
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipientMode === "all" ? "all" : singleAccountId,
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({
          ok: true,
          text: data.data.message || "Email sent successfully.",
        });
        setSubject("");
        setMessage("");
        if (recipientMode === "single") setSingleAccountId("");
      } else {
        setResult({ ok: false, text: data.error || "Failed to send email." });
      }
    } catch {
      setResult({ ok: false, text: "Unexpected error while sending email." });
    } finally {
      setSending(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-[#e50914]/60 focus:bg-white/10 transition-colors";

  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl mt-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Mail className="h-5 w-5 text-[#e50914]" />
        <h2 className="text-xl font-bold text-white">Broadcast Email</h2>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-neutral-400">
        Send an instant email to every user, or to a single user. Each recipient is
        greeted by name automatically.
      </p>

      {/* Recipient selector */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setRecipientMode("all");
              setResult(null);
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              recipientMode === "all"
                ? "bg-[#e50914] text-white"
                : "bg-white/10 text-neutral-300 hover:bg-white/20"
            }`}
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            All users ({allAccounts.length})
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setRecipientMode("single");
              setResult(null);
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              recipientMode === "single"
                ? "bg-[#e50914] text-white"
                : "bg-white/10 text-neutral-300 hover:bg-white/20"
            }`}
          >
            Specific user
          </Button>
        </div>

        {recipientMode === "single" && (
          <select
            value={singleAccountId}
            onChange={(e) => {
              setSingleAccountId(e.target.value);
              setResult(null);
            }}
            className={`${inputCls} cursor-pointer`}
            disabled={accountsLoading}
          >
            <option value="">Select a user…</option>
            {allAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.username} — {a.email}
              </option>
            ))}
          </select>
        )}
        {accountsLoading && recipientMode === "single" && (
          <p className="mt-1 text-[11px] text-neutral-500">Loading users…</p>
        )}
      </div>

      {/* Subject */}
      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-400">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="e.g. Important update"
          className={inputCls}
        />
      </div>

      {/* Message */}
      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-neutral-400">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={10000}
          placeholder="Write your announcement or message for your users…"
          className={`${inputCls} resize-y`}
        />
      </div>

      {/* Template preview */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
          Preview
        </p>
        <p className="text-sm font-bold text-[#e50914]">Hi (username)!</p>
        <p className="text-xs leading-relaxed text-neutral-300">
          {message.trim() || "Your message will appear here…"}
        </p>
        <hr className="my-3 border-white/10" />
        <p className="text-[11px] text-neutral-500">
          Need help? Email us at movieflix.support@gmail.com
        </p>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
            result.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {result.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{result.text}</span>
        </div>
      )}

      <Button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e50914] text-sm font-bold text-white transition-colors hover:bg-[#f6121d] disabled:opacity-60"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Send Email
          </>
        )}
      </Button>
    </div>
  );
}
