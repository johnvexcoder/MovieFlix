"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquareText, AlertTriangle, Lightbulb, HeartHandshake } from "lucide-react";

interface ContactSubmission {
  id: string;
  type: "report" | "feedback" | "suggestion";
  subject: string | null;
  message: string;
  accountId: string | null;
  accountUsername: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  report: { label: "Report", cls: "bg-red-500/15 text-red-400", icon: null },
  feedback: { label: "Feedback", cls: "bg-emerald-500/15 text-emerald-400", icon: null },
  suggestion: { label: "Suggestion", cls: "bg-amber-500/15 text-amber-400", icon: null },
};

export function ContactSubmissionsAdmin() {
  const [items, setItems] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/contact", { cache: "no-store" });
        const data = await res.json();
        if (data.success && mounted) setItems(data.data.submissions);
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const iconFor = (type: string) =>
    type === "report" ? (
      <AlertTriangle className="h-3.5 w-3.5" />
    ) : type === "suggestion" ? (
      <Lightbulb className="h-3.5 w-3.5" />
    ) : (
      <HeartHandshake className="h-3.5 w-3.5" />
    );

  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl mt-6">
      <div className="mb-4 flex items-center gap-2.5">
        <MessageSquareText className="h-5 w-5 text-sky-400" />
        <h2 className="text-xl font-bold text-white">Contact Submissions</h2>
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-300">
          {items.length}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center">
          <MessageSquareText className="mx-auto mb-2 h-8 w-8 text-neutral-600" />
          <p className="text-xs text-neutral-400">No reports, feedback, or suggestions yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.feedback;
            return (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                    {iconFor(item.type)}
                    {meta.label}
                  </span>
                  {item.subject && <p className="text-sm font-bold text-white">{item.subject}</p>}
                  <span className="ml-auto text-[10px] text-neutral-500">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                {item.accountUsername && (
                  <p className="mt-0.5 text-[11px] text-neutral-500">From {item.accountUsername}</p>
                )}
                <p className="mt-2 break-words text-xs leading-relaxed text-neutral-300">{item.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}