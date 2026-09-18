"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Film, Tv, Plus, Trash2, Loader2, RefreshCw, CheckCircle, XCircle, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdminPage, AdminSection } from "@/components/admin/admin-page";
import { TmdbSettings } from "@/components/admin/tmdb-settings";
import { ScannerSettings } from "@/components/admin/scanner-settings";

interface LibraryItem {
  id: string;
  path: string;
  type: string;
  enabled: boolean;
  lastScanAt: string | null;
  createdAt: string;
}

export default function AdminMediaPage() {
  const [libraries, setLibraries] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [newPath, setNewPath] = useState("");
  const [newType, setNewType] = useState<"movies" | "series">("movies");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchLibraries();
  }, []);

  async function fetchLibraries() {
    try {
      const response = await fetch("/api/library");
      const data = await response.json();
      if (data.success) setLibraries(data.data.libraries);
    } catch (error) {
      console.error("Failed to fetch libraries:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddLibrary() {
    if (!newPath.trim()) return;
    setAdding(true);
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newPath.trim(), type: newType }),
      });
      const data = await response.json();
      if (data.success) {
        setAddModalOpen(false);
        setNewPath("");
        fetchLibraries();
      } else {
        alert(data.error || "Failed to add library path");
      }
    } catch {
      alert("Failed to add library path");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteLibrary(id: string, path: string) {
    if (!confirm(`Remove library path "${path}"?`)) return;
    const response = await fetch(`/api/library?id=${id}`, { method: "DELETE" });
    const data = await response.json();
    if (data.success) fetchLibraries();
    else alert(data.error || "Failed to delete library");
  }

  async function handleToggleLibrary(id: string, enabled: boolean) {
    const response = await fetch("/api/library", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    const data = await response.json();
    if (data.success) fetchLibraries();
    else alert(data.error || "Failed to update library");
  }

  async function handleScan() {
    setScanning(true);
    setScanMessage("Scanning filesystem & fetching metadata…");
    try {
      const response = await fetch("/api/library/scan", { method: "POST" });
      const data = await response.json();
      setScanMessage(data.success ? "Scan complete! Media library has been synchronized." : (data.error || "Scan failed."));
      if (data.success) fetchLibraries();
    } catch {
      setScanMessage("Failed to connect to scanner service.");
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 5000);
    }
  }

  return (
    <AdminPage
      title="Media Library"
      description="Media source directories, indexing, and metadata."
      actions={
        <>
          <Button onClick={handleScan} disabled={scanning} variant="outline" className="rounded-xl border-white/15 bg-white/5 text-xs font-bold hover:bg-white/15">
            {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4 text-[var(--brand)]" />}
            {scanning ? "Scanning…" : "Scan Now"}
          </Button>
          <Button onClick={() => setAddModalOpen(true)} className="btn-brand rounded-xl text-xs font-bold">
            <Plus className="mr-1.5 h-4 w-4" /> Add Directory
          </Button>
        </>
      }
    >
      {scanMessage && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-cyan-950/40 p-4 text-xs font-semibold text-neutral-200">
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--brand)]" />
          <span>{scanMessage}</span>
        </motion.div>
      )}

      <AdminSection>
        <section className="admin-card">
          <div className="admin-card-header">
            <div className="admin-card-title">
              <HardDrive className="h-5 w-5 text-cyan-300" />
              <div>
                <h2>Media sources</h2>
                <p>Filesystem directories indexed for movies and series.</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[var(--brand)]" /></div>
          ) : libraries.length === 0 ? (
            <div className="admin-empty">
              <HardDrive className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
              <h3 className="text-lg font-bold text-white">No media paths added</h3>
              <p className="mt-2 max-w-md mx-auto text-xs text-neutral-400">Add a path to your local movies or series storage to begin indexing.</p>
              <Button onClick={() => setAddModalOpen(true)} className="btn-brand mt-5 rounded-xl"><Plus className="mr-2 h-4 w-4" /> Add your first library</Button>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {libraries.map((lib) => (
                <motion.div key={lib.id} layout className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-white/20">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-900/40 text-cyan-300 ring-1 ring-cyan-400/30">
                      {lib.type === "movies" ? <Film className="h-6 w-6" /> : <Tv className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate font-mono text-sm font-bold text-white">{lib.path}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="badge-quality uppercase">{lib.type}</span>
                        {lib.enabled ? (
                          <span className="badge-quality border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400"><CheckCircle className="mr-1 h-3 w-3" /> Enabled</span>
                        ) : (
                          <span className="badge-quality border-neutral-600 text-neutral-400"><XCircle className="mr-1 h-3 w-3" /> Disabled</span>
                        )}
                        {lib.lastScanAt && <span className="text-[11px] text-neutral-500">Last indexed: {new Date(lib.lastScanAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold" onClick={() => handleToggleLibrary(lib.id, lib.enabled)}>
                      {lib.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="destructive" size="sm" className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" onClick={() => handleDeleteLibrary(lib.id, lib.path)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        <TmdbSettings />
        <ScannerSettings />
      </AdminSection>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add Library Path</DialogTitle>
            <DialogDescription className="text-neutral-400">Register a directory to scan for movie or series media files.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Filesystem Absolute Path</Label>
              <Input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/media/movies or /mnt/nas/series" className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 font-mono text-sm text-white" autoFocus />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Content Category</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setNewType("movies")} className={`rounded-xl py-3 ${newType === "movies" ? "bg-primary text-white border-transparent" : "border-white/15 bg-white/5 text-neutral-300"}`}><Film className="mr-2 h-4 w-4" /> Movies</Button>
                <Button type="button" variant="outline" onClick={() => setNewType("series")} className={`rounded-xl py-3 ${newType === "series" ? "bg-primary text-white border-transparent" : "border-white/15 bg-white/5 text-neutral-300"}`}><Tv className="mr-2 h-4 w-4" /> TV Series</Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setAddModalOpen(false)} disabled={adding}>Cancel</Button>
            <Button onClick={handleAddLibrary} disabled={adding || !newPath.trim()} className="btn-brand rounded-xl">{adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add Directory</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}