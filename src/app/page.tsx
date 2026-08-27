"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SplashScreen } from "@/components/splash-screen";
import { AnimatePresence } from "framer-motion";
import { checkUserSession } from "@/lib/client-auth";

export default function HomePage() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  const handleSplashComplete = useCallback(() => {
    setRedirecting(true);
  }, []);

  useEffect(() => {
    if (!redirecting) return;

    let cancelled = false;

    async function checkAuth() {
      try {
        const authed = await checkUserSession();
        if (!cancelled) {
          router.replace(authed ? "/profiles" : "/login");
        }
      } catch {
        if (!cancelled) {
          router.replace("/login");
        }
      }
    }

    // Small delay after splash so the redirect is smooth
    const timer = setTimeout(() => {
      if (!cancelled) {
        setShowSplash(false);
        checkAuth();
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [redirecting, router]);

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <SplashScreen
            onComplete={() => {
              setRedirecting(true);
            }}
          />
        )}
      </AnimatePresence>

      <div className="cinematic-bg flex min-h-screen items-center justify-center" />
    </>
  );
}