"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PackageRow {
  id: string; mediaId: string; episodeId: string | null; version: number;
  status: string; sizeBytes: number | null; errorCode: string | null;
}
interface JobRow { id: string; packageId: string; status: string; progress: number; attempts: number; }

export function StreamingPreparationAdmin() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [mediaId, setMediaId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/streaming", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setPackages(data.packages); setJobs(data.jobs); }
  }, []);
  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 10_000);
    return () => window.clearInterval(interval);
  }, [load]);
  async function action(body: Record<string, string | null>) {
    const response = await fetch("/api/admin/streaming", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Action failed"); return; }
    setError("");
    await load();
  }
  const visible = useMemo(() => packages.filter((item) =>
    `${item.mediaId} ${item.episodeId || ""} ${item.status} ${item.errorCode || ""}`
      .toLowerCase().includes(query.toLowerCase())), [packages, query]);
  return <section className="glass-panel rounded-3xl border border-white/10 p-4 sm:p-6">
    <h2 className="text-lg font-bold text-white">Streaming preparation</h2>
    <p className="mt-1 text-xs text-slate-400">Prepared packages stay private and persist under the data mount.</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <Input aria-label="Media ID" placeholder="Media ID" value={mediaId} onChange={(event) => setMediaId(event.target.value)} className="max-w-64" />
      <Input aria-label="Episode ID" placeholder="Episode ID (optional)" value={episodeId} onChange={(event) => setEpisodeId(event.target.value)} className="max-w-64" />
      <Button onClick={() => void action({ action: "queue", mediaId, episodeId: episodeId || null })}>Queue preparation</Button>
      <Input aria-label="Search packages" placeholder="Search packages" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-64" />
    </div>
    {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    <div className="mt-4 max-h-[360px] overflow-y-auto overscroll-contain rounded-xl border border-white/10">
      {visible.map((item) => {
        const job = jobs.find((entry) => entry.packageId === item.id);
        return <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-white/10 p-3 text-xs">
          <span className="min-w-0 flex-1"><b className="text-white">{item.mediaId}</b>{item.episodeId && ` · ${item.episodeId}`} · v{item.version}
            <span className="ml-2 text-cyan-300">{item.status}</span>{job && ` · ${job.progress}%`}
            {item.sizeBytes && ` · ${(item.sizeBytes / 1024 ** 3).toFixed(2)} GB`}
            {item.errorCode && <span className="block text-red-300">{item.errorCode}</span>}
          </span>
          {item.status === "FAILED" && <Button size="sm" onClick={() => void action({ action: "retry", mediaId: item.mediaId, episodeId: item.episodeId })}>Retry</Button>}
          {job && ["QUEUED", "PROBING", "ENCODING", "VALIDATING"].includes(job.status) &&
            <Button size="sm" variant="outline" onClick={() => void action({ action: "cancel", jobId: job.id })}>Cancel</Button>}
        </div>;
      })}
      {visible.length === 0 && <p className="p-6 text-center text-xs text-slate-400">No packages found.</p>}
    </div>
  </section>;
}
