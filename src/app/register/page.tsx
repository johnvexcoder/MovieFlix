"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MovieFlixLogo } from "@/components/movieflix-logo";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", fullName: "", dateOfBirth: "", contactNumber: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const field = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      sessionStorage.setItem("movieflix_signup_token", data.data.signupToken);
      router.push("/register/payment");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Registration failed"); }
    finally { setLoading(false); }
  }

  const fields = [["username", "Username", "text"], ["fullName", "Full name", "text"], ["dateOfBirth", "Date of birth", "date"], ["contactNumber", "Contact number", "tel"], ["email", "Email address", "email"], ["password", "Password", "password"]] as const;
  return <main className="cinematic-bg min-h-screen px-4 py-10 text-white"><div className="mx-auto w-full max-w-xl rounded-3xl border border-cyan-400/20 bg-[#0b1629]/95 p-6 shadow-2xl sm:p-9"><div className="mb-7 text-center"><MovieFlixLogo className="mx-auto h-16 w-16"/><h1 className="mt-3 text-3xl font-black">Create your account</h1><p className="mt-2 text-sm text-slate-400">Choose your plan after registration.</p></div><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label, type]) => <div key={key}><Label htmlFor={key}>{label}</Label><div className={key === "password" ? "relative" : ""}><Input id={key} type={key === "password" && showPassword ? "text" : type} value={form[key]} onChange={field(key)} required className={`mt-1.5 h-12 border-white/15 bg-white/5 ${key === "password" ? "pr-12" : ""}`} autoComplete={key === "password" ? "new-password" : undefined}/>{key === "password" && <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 mt-1.5 flex w-12 items-center justify-center rounded-r-md text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300">{showPassword ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}</button>}</div></div>)}{error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200 sm:col-span-2">{error}</p>}<Button disabled={loading} className="btn-brand h-12 sm:col-span-2">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Continue to plans</Button></form><Link href="/login" className="mt-5 block text-center text-sm text-cyan-300 hover:underline">Already registered? Sign in</Link></div></main>;
}
