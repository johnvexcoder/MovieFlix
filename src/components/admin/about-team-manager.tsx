"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AboutTeamMember {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
  positionX: number;
  positionY: number;
  scale: number;
}

const blank = (): AboutTeamMember => ({
  id: crypto.randomUUID(), name: "", role: "", imageUrl: "", positionX: 50, positionY: 50, scale: 100,
});

export function AboutTeamManager() {
  const [members, setMembers] = useState<AboutTeamMember[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => r.json()).then((data) => {
      try {
        const parsed = JSON.parse(data.data?.settings?.about_team || "[]");
        if (Array.isArray(parsed)) setMembers(parsed);
      } catch {}
    });
  }, []);

  function update(id: string, values: Partial<AboutTeamMember>) {
    setMembers((current) => current.map((member) => member.id === id ? { ...member, ...values } : member));
  }

  async function upload(id: string, file?: File) {
    if (!file) return;
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      update(id, { imageUrl: data.data.url });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Image upload failed");
    } finally { setBusy(false); }
  }

  async function save() {
    const valid = members.filter((member) => member.name.trim() && member.role.trim() && member.imageUrl);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { about_team: JSON.stringify(valid) } }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setMembers(valid); setMessage("About page team saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save team");
    } finally { setBusy(false); }
  }

  return <section className="glass-panel rounded-3xl border border-white/10 p-4 shadow-xl sm:p-6 xl:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-bold"><Users className="h-5 w-5 text-cyan-300"/>About Page Team</h2><p className="mt-1 text-xs text-neutral-400">Add only the people you want shown. Image framing is saved per card.</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={members.length >= 12} onClick={() => setMembers((m) => [...m, blank()])}><Plus className="mr-2 h-4 w-4"/>Add person</Button><Button className="btn-brand" disabled={busy} onClick={save}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}Save team</Button></div>
    </div>
    {members.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-neutral-500">No team profiles are published.</div>}
    <div className="mt-5 grid gap-4 md:grid-cols-2">{members.map((member) => <article key={member.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl bg-[#07101f]">
        {member.imageUrl ? <img src={member.imageUrl} alt="" className="h-full w-full" style={{objectFit:"cover",objectPosition:`${member.positionX}% ${member.positionY}%`,transform:`scale(${member.scale/100})`}}/>:<div className="flex h-full items-center justify-center text-neutral-600"><ImagePlus className="h-10 w-10"/></div>}
        <div className="absolute inset-x-2 bottom-2 rounded-xl bg-black/55 p-3 backdrop-blur-md"><b className="block text-lg">{member.name||"Name"}</b><span className="text-xs uppercase tracking-wider text-cyan-200">{member.role||"Position"}</span></div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><Label>Name</Label><Input value={member.name} onChange={(e)=>update(member.id,{name:e.target.value})}/></div><div><Label>Position</Label><Input value={member.role} onChange={(e)=>update(member.id,{role:e.target.value})}/></div></div>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-white/15 text-sm font-bold hover:bg-white/5"><ImagePlus className="mr-2 h-4 w-4"/>Choose image<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>upload(member.id,e.target.files?.[0])}/></label>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs"><label>X position<Input type="range" min="0" max="100" value={member.positionX} onChange={(e)=>update(member.id,{positionX:Number(e.target.value)})}/></label><label>Y position<Input type="range" min="0" max="100" value={member.positionY} onChange={(e)=>update(member.id,{positionY:Number(e.target.value)})}/></label><label>Zoom<Input type="range" min="100" max="180" value={member.scale} onChange={(e)=>update(member.id,{scale:Number(e.target.value)})}/></label></div>
      <Button variant="ghost" className="mt-2 text-red-300" onClick={()=>setMembers((m)=>m.filter((x)=>x.id!==member.id))}><Trash2 className="mr-2 h-4 w-4"/>Remove</Button>
    </article>)}</div>
    {message && <p className="mt-4 text-sm text-cyan-200">{message}</p>}
  </section>;
}
