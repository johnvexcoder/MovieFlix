"use client";

import { useState } from "react";
import { Loader2, Lightbulb, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface SuggestionModalProps {
  open: boolean;
  onClose: () => void;
}

export function SuggestionModal({ open, onClose }: SuggestionModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "suggestion",
          subject: subject.trim() || undefined,
          message,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setTimeout(() => {
          setDone(false);
          setSubject("");
          setMessage("");
          onClose();
        }, 1500);
      } else {
        setError(data.error || "Failed to send suggestion");
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/30">
              <Lightbulb className="h-6 w-6 text-amber-400" />
            </div>
            <DialogTitle className="text-2xl text-white font-bold">Send a Suggestion</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Have an idea to make MovieFlix better? We&apos;d love to hear it.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Subject <span className="text-neutral-500">(optional)</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={'e.g. «4K» playback'}
                maxLength={120}
                className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#e50914]/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Suggestion</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your suggestion…"
                rows={5}
                maxLength={5000}
                required
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#e50914]/40"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 font-medium">
                {error}
              </div>
            )}

            {done && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-400">
                <CheckCircle className="h-4 w-4" /> Thank you! Your suggestion has been received.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl border-white/10 text-neutral-200" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="btn-brand rounded-xl text-xs font-bold"
                disabled={loading || message.trim().length < 3}
              >
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-1.5 h-4 w-4" />}
                Send Suggestion
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}