"use client";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

interface SecurityStatus {
  email: string | null;
  twoFactorEnabled: boolean;
  recoveryCodesRemaining: number;
}

export function AdminRecoveryOnboarding() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/auth/security", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.success && setStatus(d.data))
      .catch(() => {});
  }, []);

  if (!status) return null;

  const missingEmail = !status.email;
  const missingTwoFactor = !status.twoFactorEnabled;
  const missingCodes = status.recoveryCodesRemaining <= 0;

  if (!missingEmail && !missingTwoFactor && !missingCodes) return null;

  const items = [
    missingEmail ? "Recovery email" : null,
    missingTwoFactor ? "Two-step verification" : null,
    missingCodes ? "Recovery codes" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-bold text-amber-200">Complete account recovery setup</p>
          <p className="text-xs text-slate-300">
            Set up {items.join(", ")} to protect against lockout. Update it in the Identity &amp; Administration section below.
          </p>
        </div>
      </div>
    </div>
  );
}