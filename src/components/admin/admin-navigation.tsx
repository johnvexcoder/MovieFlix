"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, Settings } from "lucide-react";
import { MovieFlixLogo } from "@/components/movieflix-logo";

const links = [
  { href: "/admin-panel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin-panel/libraries", label: "Libraries", icon: Library },
  { href: "/admin-panel/settings", label: "Settings", icon: Settings },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return <header className="sticky top-0 z-50 border-b border-cyan-300/10 bg-[#050b16]/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
      <Link href="/admin-panel" className="flex items-center gap-2.5 rounded-xl px-1 text-white">
        <MovieFlixLogo className="h-9 w-9" size={36}/><span><b className="block leading-none">MovieFlix</b><small className="text-[10px] uppercase tracking-[.18em] text-cyan-300">Control center</small></span>
      </Link>
      <nav className="flex w-full gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 sm:w-auto">
        {links.map(({href,label,icon:Icon}) => { const active = href === "/admin-panel" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition sm:flex-none ${active?"bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(0,210,245,.22)]":"text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4"/><span>{label}</span></Link>})}
      </nav>
    </div>
  </header>;
}
