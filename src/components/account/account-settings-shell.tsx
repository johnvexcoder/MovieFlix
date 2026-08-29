"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { checkUserSession } from "@/lib/client-auth";
import { MovieFlixLogo } from "@/components/movieflix-logo";

interface AccountSettingsShellProps {
  heading: string;
  subheading: string;
  children: React.ReactNode;
}

export function AccountSettingsShell({ heading, subheading, children }: AccountSettingsShellProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function gate() {
      const authed = await checkUserSession();
      if (!cancelled) {
        setChecking(false);
        if (!authed) router.replace("/login");
      }
    }
    gate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709]">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] px-4 py-8 sm:px-8 select-none">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-neutral-300 hover:bg-white/15 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <MovieFlixLogo className="h-8 w-8" size={32} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{heading}</h1>
        <p className="mt-1 text-sm text-neutral-400">{subheading}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}