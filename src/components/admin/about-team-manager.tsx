"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Pencil, Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface AboutTeamMember { id: string; name: string; role: string; imageUrl: string; positionX: number; positionY: number; scale: number; }
const blank = (): AboutTeamMember => ({ id: crypto.randomUUID(), name: "", role: "", imageUrl: "", positionX: 50, positionY: 50, scale: 100 });

async function optimizedImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, 1200 / image.naturalWidth, 1600 / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext("2d", { alpha: false })?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}

export function AboutTeamManager() {
  const [members, setMembers] = useState<AboutTeamMember[]>([]);
  const [editing, setEditing] = useState<AboutTeamMember | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { fetch("/api/admin/settings", { cache: "no-store" }).then((r) => r.json()).then((data) => { try { const parsed = JSON.parse(data.data?.settings?.about_team || "[]"); if (Array.isArray(parsed)) setMembers(parsed); } catch {} }); }, []);
  const patch = (values: Partial<AboutTeamMember>) => setEditing((current) => current ? { ...current, ...values } : current);
  const commitEditor = () => { if (!editing) return; setMembers((current) => isNew ? [...current, editing] : current.map((member) => member.id === editing.id ? editing : member)); setEditing(null); };
  async function upload(file?: File) {
    if (!file || !editing) return;
    setBusy(true); setMessage("");
    try {
      const converted = await optimizedImage(file);
      const body = new FormData(); body.append("file", converted);
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      patch({ imageUrl: data.data.url });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Image upload failed"); } finally { setBusy(false); }
  }
  async function save() {
    const valid = members.filter((member) => member.name.trim() && member.role.trim() && member.imageUrl);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: { about_team: JSON.stringify(valid) } }) });
      const data = await response.json(); if (!data.success) throw new Error(data.error);
      setMembers(valid); setMessage("About page team saved and published.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save team"); } finally { setBusy(false); }
  }

  return <section className="glass-panel rounded-3xl border border-white/10 p-4 shadow-xl sm:p-6 xl:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-cyan-300"/>About Page Team</h2><p className="mt-1 text-xs text-neutral-400">Compact roster. Open a person to edit their details and image framing.</p></div><div className="flex gap-2"><Button variant="outline" disabled={members.length >= 12} onClick={() => { setEditing(blank()); setIsNew(true); }}><Plus className="mr-2 h-4 w-4"/>Add person</Button><Button className="btn-brand" disabled={busy} onClick={save}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}Publish</Button></div></div>
    {members.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center text-sm text-neutral-500">No team profiles are published.</div> : <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{members.map((member) => <article key={member.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2"><div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-[#07101f]">{member.imageUrl ? <img src={member.imageUrl} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${member.positionX}% ${member.positionY}%` }}/> : <ImagePlus className="m-4 h-6 w-6 text-neutral-600"/>}</div><div className="min-w-0 flex-1"><b className="block truncate text-sm">{member.name}</b><span className="block truncate text-[10px] uppercase tracking-wider text-cyan-200">{member.role}</span></div><button type="button" aria-label={`Edit ${member.name}`} onClick={() => { setEditing({ ...member }); setIsNew(false); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-cyan-300 hover:bg-white/10"><Pencil className="h-4 w-4"/></button></article>)}</div>}
    {message && <p className="mt-3 text-sm text-cyan-200">{message}</p>}

    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent className="glass-panel max-h-[calc(100dvh-1rem)] overflow-y-auto border-white/15 p-4 sm:max-w-lg sm:p-6"><DialogHeader><DialogTitle>{isNew ? "Add team profile" : "Edit team profile"}</DialogTitle><DialogDescription>Images are resized and converted to lightweight WebP before upload when the browser supports it.</DialogDescription></DialogHeader>{editing && <div className="space-y-3"><div className="relative mx-auto aspect-[3/4] w-44 overflow-hidden rounded-xl bg-[#07101f]">{editing.imageUrl ? <img src={editing.imageUrl} alt="Preview" className="h-full w-full" style={{ objectFit: "cover", objectPosition: `${editing.positionX}% ${editing.positionY}%`, transform: `scale(${editing.scale / 100})` }}/> : <div className="flex h-full items-center justify-center"><ImagePlus className="h-9 w-9 text-neutral-600"/></div>}<div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/65 p-2 backdrop-blur"><b className="block truncate">{editing.name || "Name"}</b><span className="text-[10px] uppercase text-cyan-200">{editing.role || "Position"}</span></div></div><div className="grid gap-3 sm:grid-cols-2"><label><Label>Name</Label><Input value={editing.name} onChange={(event) => patch({ name: event.target.value })}/></label><label><Label>Position</Label><Input value={editing.role} onChange={(event) => patch({ role: event.target.value })}/></label></div><label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-white/15 text-sm font-bold hover:bg-white/5"><ImagePlus className="mr-2 h-4 w-4"/>{busy ? "Optimizing image…" : "Choose image"}<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])}/></label><div className="grid grid-cols-3 gap-3 text-xs"><label>X position<Input type="range" min="0" max="100" value={editing.positionX} onChange={(event) => patch({ positionX: Number(event.target.value) })}/></label><label>Y position<Input type="range" min="0" max="100" value={editing.positionY} onChange={(event) => patch({ positionY: Number(event.target.value) })}/></label><label>Zoom<Input type="range" min="100" max="180" value={editing.scale} onChange={(event) => patch({ scale: Number(event.target.value) })}/></label></div><div className="flex flex-wrap justify-between gap-2">{!isNew && <Button variant="ghost" className="text-red-300" onClick={() => { setMembers((current) => current.filter((member) => member.id !== editing.id)); setEditing(null); }}><Trash2 className="mr-2 h-4 w-4"/>Remove</Button>}<Button className="btn-brand ml-auto" disabled={busy || !editing.name.trim() || !editing.role.trim() || !editing.imageUrl} onClick={commitEditor}><Save className="mr-2 h-4 w-4"/>Save profile</Button></div></div>}</DialogContent></Dialog>
  </section>;
}
