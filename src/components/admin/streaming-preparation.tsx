"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PackageRow {
  id: string; mediaId: string; episodeId: string | null; version: number;
  status: string; sizeBytes: number | null; errorCode: string | null;
  preparedAt: string | null; updatedAt: string;
}
interface JobRow {
  id: string; packageId: string; status: string; stage: string;
  progress: number; attempts: number; errorCode: string | null; updatedAt: string;
}
interface MediaOption { id: string; title: string; type: string; }
interface EpisodeOption { id: string; mediaId: string; episodeNumber: number; title: string | null; }

const selectClass =
  "h-9 w-full rounded-lg border border-white/10 bg-[#111827] px-3 text-sm text-white outline-none focus:border-cyan-300/40";

export function StreamingPreparationAdmin() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [mediaOptions, setMediaOptions] = useState<MediaOption[]>([]);
  const [episodeOptions, setEpisodeOptions] = useState<EpisodeOption[]>([]);
  const [mediaId, setMediaId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/streaming", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not load streaming data.");
        return;
      }
      setPackages(data.packages ?? []);
      setJobs(data.jobs ?? []);
      setMediaOptions(data.media ?? []);
      setEpisodeOptions(data.episodes ?? []);
    } catch {
      setError("Could not reach the streaming service.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = window.setInterval(load, 10_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function action(body: Record<string, string | null>) {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/streaming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Action failed");
        return;
      }
      setError("");
      await load();
    } catch {
      setError("Could not reach the streaming service.");
    } finally {
      setLoading(false);
    }
  }

  const episodesForMedia = useMemo(
    () => episodeOptions.filter((entry) => entry.mediaId === mediaId),
    [episodeOptions, mediaId]
  );

  const mediaTitle = useCallback(
    (id: string) => mediaOptions.find((entry) => entry.id === id)?.title ?? id,
    [mediaOptions]
  );

  const visible = useMemo(() => packages.filter((item) =>
    `${item.mediaId} ${mediaTitle(item.mediaId)} ${item.episodeId || ""} ${item.status} ${item.errorCode || ""}`
      .toLowerCase().includes(query.toLowerCase())), [packages, query, mediaTitle]);

  return <section className="glass-panel rounded-3xl border border-white/10 p-4 sm:p-6">
    <h2 className="text-lg font-bold text-white">Streaming preparation</h2>
    <p className="mt-1 text-xs text-slate-400">Prepared packages stay private and persist under the data mount.</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <label className="min-w-0">
        <span className="mb-1 block text-[11px] font-medium text-slate-400">Media</span>
        <select
          aria-label="Media"
          className={selectClass}
          value={mediaId}
          onChange={(event) => { setMediaId(event.target.value); setEpisodeId(""); }}
        >
          <option value="">Select media…</option>
          {mediaOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} ({item.type})
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-[11px] font-medium text-slate-400">Episode (optional)</span>
        <select
          aria-label="Episode"
          className={selectClass}
          value={episodeId}
          disabled={episodesForMedia.length === 0}
          onChange={(event) => setEpisodeId(event.target.value)}
        >
          <option value="">{episodesForMedia.length === 0 ? "No episodes / not a series" : "Entire title"}</option>
          {episodesForMedia.map((episode) => (
            <option key={episode.id} value={episode.id}>
              E{episode.episodeNumber}{episode.title ? ` · ${episode.title}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <Button
          className="w-full"
          disabled={!mediaId || loading}
          onClick={() => void action({ action: "queue", mediaId, episodeId: episodeId || null })}
        >
          {loading ? "Working…" : "Queue preparation"}
        </Button>
      </div>
      <div className="flex items-end">
        <Input
          aria-label="Search packages"
          placeholder="Search packages"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
    </div>
    {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    <div className="mt-4 max-h-[400px] overflow-y-auto overscroll-contain rounded-xl border border-white/10">
      {visible.map((item) => {
        const job = jobs.find((entry) => entry.packageId === item.id);
        const sizeLabel = item.sizeBytes != null && item.sizeBytes > 0
          ? `${(item.sizeBytes / 1024 ** 3).toFixed(2)} GB`
          : null;
        const log = job?.errorCode || item.errorCode;
        return <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-white/10 p-3 text-xs">
          <span className="min-w-0 flex-1">
            <b className="text-white">{mediaTitle(item.mediaId)}</b>
            {item.episodeId && ` · ${item.episodeId}`} · v{item.version}
            <span className="ml-2 text-cyan-300">{item.status}</span>
            {job && ` · ${job.stage} ${job.progress}%`}
            {job && job.attempts > 1 && ` · attempt ${job.attempts}`}
            {sizeLabel && ` · ${sizeLabel}`}
            {log && <span className="block text-red-300">{log}</span>}
            {!log && item.preparedAt && (
              <span className="block text-slate-500">Prepared {new Date(item.preparedAt).toLocaleString()}</span>
            )}
          </span>
          {item.status === "FAILED" && (
            <Button size="sm" disabled={loading} onClick={() => void action({ action: "retry", mediaId: item.mediaId, episodeId: item.episodeId })}>
              Retry
            </Button>
          )}
          {job && ["QUEUED", "PROBING", "ENCODING", "VALIDATING"].includes(job.status) &&
            <Button size="sm" variant="outline" disabled={loading} onClick={() => void action({ action: "cancel", jobId: job.id })}>Cancel</Button>}
        </div>;
      })}
      {visible.length === 0 && <p className="p-6 text-center text-xs text-slate-400">No packages found.</p>}
    </div>
  </section>;
}
