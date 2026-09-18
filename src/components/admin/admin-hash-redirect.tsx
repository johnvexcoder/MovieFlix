"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

// Compatibility redirects for the old hash-anchor admin routes.
const HASH_MAP: Record<string, string> = {
  "#broadcast": "/admin-panel/broadcast",
  "#reports": "/admin-panel/reports",
  "#membership": "/admin-panel/membership",
  "#platform": "/admin-panel/platform",
  "#media": "/admin-panel/media",
};

export function AdminHashRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const target = HASH_MAP[hash];
    if (!target) return;
    // Replace the hash URL with the real route so back/forward work naturally.
    router.replace(target);
  }, [pathname, router]);

  return null;
}