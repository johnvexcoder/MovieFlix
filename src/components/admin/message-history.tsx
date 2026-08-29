"use client";

import { useEffect, useState } from "react";
import { Loader2, Megaphone, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SentMessage {
  id: string;
  message: string;
  accountId: string | null;
  broadcast: boolean;
  accountUsername: string | null;
  createdAt: string;
}

export function MessageHistory() {
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/messages", { cache: "no-store" });
        const data = await res.json();
        if (data.success && mounted) setMessages(data.data.messages);
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this message? It can no longer be shown to users.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) setMessages((prev) => prev.filter((m) => m.id !== id));
      else alert(data.error || "Failed to delete");
    } catch {
      alert("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl mt-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Megaphone className="h-5 w-5 text-[#e50914]" />
        <h2 className="text-xl font-bold text-white">Sent Messages</h2>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-300">
          {messages.length}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        </div>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
          <Megaphone className="mx-auto mb-2 h-8 w-8 text-neutral-600" />
          <p className="text-xs text-neutral-400">No messages sent yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {messages.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      m.broadcast ? "bg-violet-500/15 text-violet-400" : "bg-sky-500/15 text-sky-400"
                    }`}
                  >
                    {m.broadcast ? "Broadcast" : "Targeted"}
                  </span>
                  {!m.broadcast && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-300">
                      <Mail className="h-3 w-3" />
                      {m.accountUsername || "Account"}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-500">{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1.5 line-clamp-3 break-words text-xs text-neutral-300">{m.message}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                disabled={deletingId === m.id}
                onClick={() => handleDelete(m.id)}
              >
                {deletingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}