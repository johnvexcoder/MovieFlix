"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminForgotPasswordPage() {
  const router = useRouter(); const [identifier, setIdentifier] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch("/api/admin/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier }) }); const data = await response.json(); if (!data.success) throw new Error(data.error); router.push(`/admin-panel/reset-password?identifier=${encodeURIComponent(identifier.trim())}`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send recovery instructions"); } finally { setLoading(false); } }
  return <main className="cinematic-bg flex min-h-screen items-center justify-center px-4 py-10 text-white"><section className="w-full max-w-md rounded-3xl border border-cyan-300/20 bg-[#0b1629]/95 p-6 shadow-2xl sm:p-9"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10"><Mail className="h-7 w-7 text-cyan-300"/></div><h1 className="mt-4 text-center text-2xl font-black">Recover admin access</h1><p className="mt-2 text-center text-sm text-slate-400">We’ll send a six-digit code and a secure reset link to the administrator recovery email.</p><form onSubmit={submit} className="mt-7 space-y-4"><div><Label htmlFor="identifier">Administrator username or email</Label><Input id="identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required autoFocus className="mt-1.5 h-12 border-white/15 bg-white/5"/></div>{error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}<Button disabled={loading || !identifier.trim()} className="btn-brand h-12 w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <KeyRound className="mr-2 h-4 w-4"/>}Send recovery instructions</Button></form><Link href="/admin-panel/login" className="mt-4 block min-h-11 py-3 text-center text-sm text-cyan-300 hover:underline">Return to admin sign in</Link></section></main>;
}
