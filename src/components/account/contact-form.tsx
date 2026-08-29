"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContactFormProps {
  type: "report" | "feedback";
  icon: React.ReactNode;
  title: string;
  description: string;
  subjectPlaceholder: string;
  messagePlaceholder: string;
  submitLabel: string;
}

export function ContactForm({
  type,
  icon,
  title,
  description,
  subjectPlaceholder,
  messagePlaceholder,
  submitLabel,
}: ContactFormProps) {
  const router = useRouter();
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
          type,
          subject: subject.trim() || undefined,
          message,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
      } else {
        setError(data.error || "Failed to submit");
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel rounded-3xl border border-white/10 p-6 sm:p-8 shadow-xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
        </div>
      </div>
      <p className="mb-6 text-sm text-neutral-400">{description}</p>

      {done ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center gap-3 py-10 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
            <CheckCircle className="h-7 w-7 text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-emerald-400">Thank you! Your submission has been received.</p>
          <Button
            variant="outline"
            className="mt-3 rounded-xl border-white/10 text-neutral-200"
            onClick={() => {
              setSubject("");
              setMessage("");
              setDone(false);
              router.back();
            }}
          >
            Back
          </Button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Subject <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={subjectPlaceholder}
              maxLength={120}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#e50914]/40"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={messagePlaceholder}
              rows={6}
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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-xl border-white/10 text-neutral-200" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" className="btn-brand rounded-xl text-xs font-bold" disabled={loading || message.trim().length < 3}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {submitLabel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}