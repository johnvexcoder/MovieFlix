"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FolderOpen,
  Film,
  Tv,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  HardDrive,
  Activity,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface LibraryItem {
  id: string;
  path: string;
  type: string;
  enabled: boolean;
  lastScanAt: string | null;
  createdAt: string;
}

export default function AdminLibrariesPage() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Add form state
  const [newPath, setNewPath] = useState("");
  const [newType, setNewType] = useState<"movies" | "series">("movies");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchLibraries();
  }, []);

  async function checkAuth() {
    const response = await fetch("/api/admin/auth/me");
    const data = await response.json();
    if (!data.success) {
      router.push("/admin-panel/login");
    }
  }

  async function fetchLibraries() {
    try {
      const response = await fetch("/api/library");
      const data = await response.json();
      if (data.success) {
        setLibraries(data.data.libraries);
      }
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

    try {
      const response = await fetch(`/api/library?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        fetchLibraries();
      } else {
        alert(data.error || "Failed to delete library");
      }
    } catch {
      alert("Failed to delete library");
    }
  }

  async function handleToggleLibrary(id: string, enabled: boolean) {
    try {
      const response = await fetch("/api/library", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: !enabled }),
      });

      const data = await response.json();
      if (data.success) {
        fetchLibraries();
      } else {
        alert(data.error || "Failed to update library");
      }
    } catch {
      alert("Failed to update library");
    }
  }

  async function handleScan() {
    setScanning(true);
    setScanMessage("Scanning filesystem & fetching TMDB metadata…");
    try {
      const response = await fetch("/api/library/scan", {
        method: "POST",
      });

      const data = await response.json();
      if (data.success) {
        setScanMessage("Scan complete! Media library has been synchronized.");
        fetchLibraries();
      } else {
        setScanMessage(data.error || "Scan failed to initiate.");
      }
    } catch {
      setScanMessage("Failed to connect to scanner service.");
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 5000);
    }
  }

  if (loading) {
    return (
      <div className="cinematic-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] text-white select-none">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/admin-panel")}
              className="h-10 w-10 rounded-full bg-white/5 text-neutral-300 hover:bg-white/15 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Media Libraries
              </h1>
              <p className="text-xs text-neutral-400">
                Configure local filesystem directories for automatic metadata indexing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={handleScan}
              disabled={scanning}
              variant="outline"
              className="rounded-xl border-white/15 bg-white/5 text-xs font-bold hover:bg-white/15"
            >
              {scanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#e50914]" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4 text-[#e50914]" />
              )}
              {scanning ? "Scanning…" : "Scan Now"}
            </Button>

            <Button onClick={() => setAddModalOpen(true)} className="btn-brand rounded-xl text-xs font-bold">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Directory
            </Button>
          </div>
        </div>

        {/* Scan Status Banner */}
        {scanMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-xs font-semibold text-neutral-200"
          >
            <Activity className="h-4 w-4 text-[#e50914] animate-pulse" />
            <span>{scanMessage}</span>
          </motion.div>
        )}

        {/* Libraries List */}
        <div className="space-y-3">
          {libraries.length === 0 ? (
            <div className="glass-panel rounded-3xl p-16 text-center border border-dashed border-white/15">
              <HardDrive className="mx-auto mb-4 h-14 w-14 text-neutral-600" />
              <h3 className="text-xl font-bold text-white">No Media Paths Added</h3>
              <p className="mt-2 text-xs text-neutral-400 max-w-md mx-auto">
                Add paths pointing to your local movies or TV series storage (e.g. <code className="text-red-400">/mnt/storage/movies</code>) to begin indexing.
              </p>
              <Button onClick={() => setAddModalOpen(true)} className="btn-brand mt-6 rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Library
              </Button>
            </div>
          ) : (
            libraries.map((lib) => (
              <motion.div
                key={lib.id}
                layout
                className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 border border-white/10 shadow-lg transition-all hover:border-white/20"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e50914]/20 to-red-950/40 text-[#e50914] ring-1 ring-red-500/30">
                    {lib.type === "movies" ? (
                      <Film className="h-6 w-6" />
                    ) : (
                      <Tv className="h-6 w-6" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h3 className="truncate font-mono text-sm font-bold text-white">
                      {lib.path}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="badge-quality uppercase">
                        {lib.type}
                      </span>
                      {lib.enabled ? (
                        <span className="badge-quality border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold">
                          <CheckCircle className="mr-1 h-3 w-3" /> Enabled
                        </span>
                      ) : (
                        <span className="badge-quality border-neutral-600 text-neutral-400">
                          <XCircle className="mr-1 h-3 w-3" /> Disabled
                        </span>
                      )}
                      {lib.lastScanAt && (
                        <span className="text-neutral-500 text-[11px]">
                          Last indexed: {new Date(lib.lastScanAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-white/15 bg-white/5 text-xs font-semibold"
                    onClick={() => handleToggleLibrary(lib.id, lib.enabled)}
                  >
                    {lib.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    onClick={() => handleDeleteLibrary(lib.id, lib.path)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Author Credits & Support Footer */}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-400">Author:</span>
            <span className="font-bold text-white">John Vex Coder</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-500">MovieFlix Platform</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/johnvexcoder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 font-semibold text-white transition-all hover:border-white/30 hover:bg-white/10"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>

            <a
              href="https://ko-fi.com/johnvexcoder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 font-bold text-amber-300 transition-all hover:bg-amber-500/20 shadow-sm"
            >
              <span>☕</span>
              <span>Buy me a coffee</span>
            </a>
          </div>
        </footer>
      </div>

      {/* Add Library Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add Library Path</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Register a directory to scan for movie or series media files.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Filesystem Absolute Path</Label>
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/media/movies or /mnt/nas/series"
                className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white font-mono text-sm"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Content Category</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewType("movies")}
                  className={`rounded-xl py-3 ${
                    newType === "movies"
                      ? "bg-[#e50914] text-white border-transparent shadow-lg shadow-red-950/60"
                      : "border-white/15 bg-white/5 text-neutral-300"
                  }`}
                >
                  <Film className="mr-2 h-4 w-4" /> Movies
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewType("series")}
                  className={`rounded-xl py-3 ${
                    newType === "series"
                      ? "bg-[#e50914] text-white border-transparent shadow-lg shadow-red-950/60"
                      : "border-white/15 bg-white/5 text-neutral-300"
                  }`}
                >
                  <Tv className="mr-2 h-4 w-4" /> TV Series
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-xl border-white/10" onClick={() => setAddModalOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={handleAddLibrary} disabled={adding || !newPath.trim()} className="btn-brand rounded-xl">
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Directory
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
