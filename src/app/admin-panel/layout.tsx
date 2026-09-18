"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { AdminHashRedirect } from "@/components/admin/admin-hash-redirect";
import { checkAdminSession } from "@/lib/client-auth";

// Routes that must NOT be wrapped in the admin shell (sidebar/guard).
const AUTH_ROUTES = ["/admin-panel/login", "/admin-panel/forgot-password", "/admin-panel/reset-password"];

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}?`));

  useEffect(() => {
    if (isAuthRoute) return;
    let mounted = true;
    checkAdminSession()
      .then((ok) => {
        if (!mounted) return;
        if (!ok) {
          router.replace("/admin-panel/login");
          return;
        }
        setAuthed(true);
      })
      .catch(() => {
        if (mounted) router.replace("/admin-panel/login");
      });
    return () => { mounted = false; };
  }, [pathname, isAuthRoute, router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (authed === null) {
    return (
      <div className="cinematic-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  return (
    <div className="admin-shell cinematic-bg min-h-screen text-white select-none">
      <AdminNavigation />
      <AdminHashRedirect />
      <div className="lg:ml-72">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-cyan-500/10 via-fuchsia-600/5 to-transparent" />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}