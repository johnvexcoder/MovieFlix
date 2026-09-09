"use client";

import { useEffect, useState } from "react";
import { Clock, Film, Shield, Sparkles } from "lucide-react";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { MovieFlixLogo } from "@/components/movieflix-logo";
import type { AboutTeamMember } from "@/components/admin/about-team-manager";

export default function AboutPage() {
  const [team, setTeam] = useState<AboutTeamMember[]>([]);
  useEffect(() => {
    fetch("/api/about").then((r) => r.json()).then((data) => {
      if (data.success && Array.isArray(data.data?.team)) setTeam(data.data.team);
    }).catch(() => {});
  }, []);

  return <AccountSettingsShell heading="About MovieFlix" subheading="Stories worth watching, ready wherever you are.">
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(0,210,245,.15),transparent_38%),#091426] p-5 shadow-2xl sm:p-8">
        <div className="flex items-center gap-4"><MovieFlixLogo className="h-16 w-16" size={64}/><div><h2 className="text-2xl font-black">MOVIE<span className="text-orange-400">FLIX</span></h2><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Streaming now</p></div></div>
        <h3 className="mt-7 max-w-xl text-3xl font-black leading-tight text-white sm:text-5xl">Entertainment that moves with you.</h3>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">MovieFlix brings movies and series together in one polished streaming experience. Discover new releases, continue from the moment you stopped, create personal profiles, build your list, and watch on the screens that matter to you.</p>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">Our service is designed for direct, dependable access to your MovieFlix catalog, with flexible membership plans, secure accounts, responsive playback, subtitles, and quality controls across phones, computers, tablets, and supported televisions.</p>
      </section>
      <div className="grid grid-cols-2 gap-3"><Feature icon={Film} title="Made for movie nights" text="A focused catalog with rich details, recommendations, and personal lists."/><Feature icon={Shield} title="Account protection" text="Protected sessions, controlled access, and server-verified membership."/><Feature icon={Clock} title="Continue anywhere" text="Resume supported titles from your saved viewing position."/><Feature icon={Sparkles} title="Always improving" text="Feedback and suggestions help shape the MovieFlix experience."/></div>
      {team.length > 0 && <section><div className="mb-3"><h2 className="text-lg font-black text-white sm:text-xl">The people behind MovieFlix</h2><p className="mt-1 text-xs text-slate-400 sm:text-sm">Building a better way to enjoy every story.</p></div><div className={`mx-auto grid grid-cols-2 justify-center gap-2 sm:gap-4 ${team.length===1?"max-w-[11rem]":"max-w-sm sm:max-w-2xl"} ${team.length>2?"lg:grid-cols-3 lg:max-w-4xl":""}`}>{team.map((member)=><article key={member.id} className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#091426] shadow-xl sm:rounded-3xl"><img src={member.imageUrl} alt={member.name} className="h-full w-full" style={{objectFit:"cover",objectPosition:`${member.positionX}% ${member.positionY}%`,transform:`scale(${member.scale/100})`}}/><div className="absolute inset-x-1.5 bottom-1.5 rounded-xl border border-white/10 bg-black/60 p-2 backdrop-blur-md sm:inset-x-3 sm:bottom-3 sm:rounded-2xl sm:p-4"><h3 className="truncate text-xs font-black text-white drop-shadow sm:text-xl">{member.name}</h3><p className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-[.1em] text-cyan-200 sm:text-xs sm:tracking-[.16em]">{member.role}</p></div></article>)}</div></section>}
      <footer className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-xs leading-5 text-neutral-400">MovieFlix streaming availability and supported playback formats depend on the media provided by your service operator and the capabilities of your device.</footer>
    </div>
  </AccountSettingsShell>;
}

function Feature({icon:Icon,title,text}:{icon:typeof Film;title:string;text:string}) { return <article className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><Icon className="h-5 w-5 text-cyan-300"/><h3 className="mt-3 text-sm font-bold text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{text}</p></article>; }
