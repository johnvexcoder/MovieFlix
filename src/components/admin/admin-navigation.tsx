"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  MessageSquareWarning,
  BadgeDollarSign,
  Library,
  Server,
  Settings,
  ShieldCheck,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { MovieFlixLogo } from "@/components/movieflix-logo";

const links = [
  { href: "/admin-panel", label: "Overview", description: "Business analytics and accounts", icon: LayoutDashboard },
  { href: "/admin-panel/broadcast", label: "Broadcast Email / Message", description: "Targeted user messaging", icon: Mail },
  { href: "/admin-panel/reports", label: "Report & Feedback", description: "User reports and feedback", icon: MessageSquareWarning },
  { href: "/admin-panel/membership", label: "Membership and Promotion", description: "Plans, pricing, promo codes", icon: BadgeDollarSign },
  { href: "/admin-panel/media", label: "Media Library", description: "Sources, indexing, metadata", icon: Library },
  { href: "/admin-panel/platform", label: "Platform and Delivery", description: "Streaming, delivery, compatibility", icon: Server },
  { href: "/admin-panel/settings", label: "System Settings", description: "Identity and Administration", icon: Settings },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin-panel") return pathname === "/admin-panel";
  return pathname.startsWith(href);
}

export function AdminNavigation() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = links.map(({ href, label, description, icon: Icon }) => {
    const active = isActive(href, pathname);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setDrawerOpen(false)}
        className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
          active
            ? "border-cyan-300/35 bg-cyan-300/12 text-white"
            : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-slate-400 group-hover:text-cyan-300"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <b className="block truncate text-sm leading-tight">{label}</b>
          <small className="hidden truncate text-[11px] font-normal text-slate-500 lg:block">{description}</small>
        </span>
      </Link>
    );
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/8 bg-[#050b16]/96 p-5 backdrop-blur-xl lg:flex">
        <Link href="/admin-panel" className="flex items-center gap-3 rounded-2xl p-2 text-white">
          <MovieFlixLogo className="h-11 w-11" size={44} />
          <span>
            <b className="block text-lg leading-none">MovieFlix</b>
            <small className="mt-1 block text-[10px] uppercase tracking-[.2em] text-cyan-300">Admin Command</small>
          </span>
        </Link>
        <div className="mt-8 space-y-1.5">{navItems}</div>
        <div className="mt-auto space-y-2">
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <ShieldCheck className="h-4 w-4" /> Secure control plane
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Administrative sessions and changes are verified server-side.</p>
          </div>
          <Link href="/admin-panel/logout" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10">
            <LogOut className="h-4 w-4" /> Logout
          </Link>
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#050b16]/95 px-3 py-2.5 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MovieFlixLogo className="h-8 w-8" size={32} />
            <b className="text-sm">MovieFlix Admin</b>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Toggle menu"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
          >
            {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-white/10 bg-[#050b16] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MovieFlixLogo className="h-9 w-9" size={36} />
                <span>
                  <b className="block text-base leading-none">MovieFlix</b>
                  <small className="mt-0.5 block text-[9px] uppercase tracking-[.2em] text-cyan-300">Admin Command</small>
                </span>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1.5">{navItems}</div>
            <Link href="/admin-panel/logout" onClick={() => setDrawerOpen(false)} className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10">
              <LogOut className="h-4 w-4" /> Logout
            </Link>
          </div>
        </div>
      )}
    </>
  );
}