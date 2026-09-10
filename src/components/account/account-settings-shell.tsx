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
  wide?: boolean;
}

export function AccountSettingsShell({ heading, subheading, children, wide = false }: AccountSettingsShellProps) {
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
        <Loader2 className="h-10 w-10 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070709] px-2.5 py-4 sm:px-8 sm:py-8 select-none">
      <div className={`mx-auto w-full min-w-0 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        <div className="mb-3 flex items-center justify-between sm:mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-neutral-300 hover:bg-white/15 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <MovieFlixLogo className="h-8 w-8" size={32} />
        </div>
        <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">{heading}</h1>
        <p className="mt-1 text-xs leading-5 text-neutral-400 sm:text-sm">{subheading}</p>
        <div className="mt-4 sm:mt-6">{children}</div>
      </div>
    </div>
  );
}
