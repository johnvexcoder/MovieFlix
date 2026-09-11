"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Loader2, RefreshCcw, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovieFlixLogo } from "@/components/movieflix-logo";
import { checkUserSession } from "@/lib/client-auth";
import { useTvBack } from "@/hooks/use-tv-navigation";

const POLL_INTERVAL_MS = 3000;

interface Challenge {
  code: string;
  qrUrl: string;
  expiresAt: number;
}

type Status = "restoring" | "creating" | "ready" | "approved" | "claiming" | "expired" | "error";

export default function TvLoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("restoring");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  // D-pad back on the TV remote returns to the classic sign-in screen.
  useTvBack(() => {
    router.push("/login");
  });

  const createChallenge = useCallback(async () => {
    setStatus("creating");
    setError(null);
    setClaimToken(null);
    setQrDataUrl(null);
    setCodeSent(false);
    setSecondsLeft(600);
    try {
      const res = await fetch("/api/auth/tv/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Could not create a TV login code");
      }
      setChallenge({
        code: String(data.data.code),
        qrUrl: String(data.data.qrUrl),
        expiresAt: Date.now() + Number(data.data.expiresIn || 600) * 1000,
      });
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a TV login code");
      setStatus("error");
    }
  }, []);

  // If the TV already has a live session, skip straight to profiles.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await checkUserSession()) {
        if (!cancelled) router.replace("/profiles");
        return;
      }
      if (!cancelled) await createChallenge();
    })();
    return () => {
      cancelled = true;
    };
  }, [router, createChallenge]);

  // Render the QR code from the approval URL.
  useEffect(() => {
    if (!challenge) return;
    let cancelled = false;
    QRCode.toDataURL(challenge.qrUrl, {
      width: 340,
      margin: 2,
      color: { dark: "#06090b", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [challenge]);

  // Countdown + auto-expire.
  useEffect(() => {
    if (!challenge || status !== "ready") return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((challenge.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setStatus("expired");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [challenge, status]);

  // Poll for phone approval.
  useEffect(() => {
    if (!challenge || status !== "ready" || codeSent) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/tv/status?code=${encodeURIComponent(challenge.code)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data?.data?.status === "approved") {
          setStatus("approved");
          setClaimToken(String(data.data.claimToken || ""));
        } else if (res.status === 404) {
          setStatus("expired");
        }
      } catch {
        // Transient network error — the next tick will retry.
      }
    };

    timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [challenge, status, codeSent]);

  // Once approved, exchange the code for a real session.
  useEffect(() => {
    if (status !== "approved" || !challenge || !claimToken || codeSent) return;
    const id = window.setTimeout(() => {
      setCodeSent(true);
      setStatus("claiming");
      void (async () => {
        try {
          const res = await fetch("/api/auth/tv/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: challenge.code, claimToken }),
          });
          const data = await res.json();
          if (res.ok && data?.success) {
            router.replace("/profiles");
            return;
          }
          if (res.status === 429 || data?.code === "ACCOUNT_SESSION_LIMIT") {
            setError(data?.error || "Too many active sessions on this account.");
          } else {
            setError(data?.error || "Could not complete TV login. Please try again.");
          }
          setStatus("expired");
        } catch {
          setError("Network error while completing TV login. Please try again.");
          setStatus("expired");
        }
      })();
    }, 0);
    return () => window.clearTimeout(id);
  }, [status, challenge, claimToken, codeSent, router]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="cinematic-bg relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12 select-none">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-[500px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/15 blur-[160px]" />
        <div className="absolute -bottom-10 right-1/4 h-[400px] w-[500px] rounded-full bg-fuchsia-600/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      <div className="relative z-10 w-full max-w-md tv:max-w-3xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 p-2 shadow-2xl ring-1 ring-white/10 tv:h-24 tv:w-24">
            <MovieFlixLogo className="h-12 w-12 tv:h-20 tv:w-20" size={48} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white tv:text-6xl">
            Sign In on Your TV
          </h1>
          <p className="mt-2 max-w-sm text-sm text-neutral-400 tv:mt-4 tv:max-w-2xl tv:text-2xl">
            Scan the QR code with your phone, or visit the link below and sign in to continue.
          </p>
        </div>

        {(status === "restoring" || status === "creating") && (
          <div className="glass-panel flex flex-col items-center justify-center gap-4 rounded-3xl p-10 tv:p-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--brand)] tv:h-14 tv:w-14" />
            <p className="text-sm text-neutral-400 tv:text-xl">Preparing your TV login…</p>
          </div>
        )}

        {status === "ready" && challenge && (
          <div className="glass-panel flex flex-col items-center rounded-3xl p-8 tv:p-12">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code to sign in to MovieFlix. Open ${challenge.qrUrl}`}
                width={340}
                height={340}
                className="rounded-2xl bg-white p-3 shadow-2xl tv:h-96 tv:w-96"
              />
            ) : (
              <div className="flex h-72 w-72 items-center justify-center rounded-2xl bg-white tv:h-96 tv:w-96">
                <Loader2 className="h-8 w-8 animate-spin text-black/40 tv:h-14 tv:w-14" />
              </div>
            )}

            <div className="mt-5 text-center tv:mt-8">
              <p className="text-sm text-neutral-400 tv:text-xl">…or enter this code on your phone:</p>
              <p className="mt-2 text-2xl font-black tracking-[0.3em] text-white tv:mt-4 tv:text-5xl">
                {challenge.code}
              </p>
            </div>

            <div className="mt-5 flex flex-col items-center gap-1 tv:mt-8">
              <p className="text-xs text-neutral-500 tv:text-lg">
                Code expires in {minutes}:{seconds}
              </p>
              {secondsLeft <= 60 && (
                <p className="text-xs font-semibold text-amber-400 tv:text-lg">
                  Expiring soon — request a new code if needed.
                </p>
              )}
            </div>
          </div>
        )}

        {(status === "approved" || status === "claiming") && (
          <div className="glass-panel flex flex-col items-center justify-center gap-4 rounded-3xl p-10 text-center tv:p-16">
            <Smartphone className="h-10 w-10 text-emerald-400 tv:h-16 tv:w-16" />
            <p className="text-xl font-bold text-white tv:text-3xl">Approved! Signing you in…</p>
            <Loader2 className="h-6 w-6 animate-spin text-[var(--brand)] tv:h-10 tv:w-10" />
          </div>
        )}

        {status === "expired" && (
          <div className="glass-panel flex flex-col items-center justify-center gap-4 rounded-3xl p-10 text-center tv:p-16">
            <p className="text-xl font-bold text-white tv:text-3xl">This code has expired</p>
            <p className="text-sm text-neutral-400 tv:text-xl">Request a new code to continue.</p>
            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs font-medium text-red-300 tv:text-lg">
                {error}
              </p>
            )}
            <Button
              onClick={createChallenge}
              className="btn-brand mt-2 h-12 px-8 tv:h-16 tv:px-16 tv:text-2xl"
            >
              <RefreshCcw className="mr-2 h-5 w-5 tv:h-8 tv:w-8" />
              Generate New Code
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="glass-panel flex flex-col items-center justify-center gap-4 rounded-3xl p-10 text-center tv:p-16">
            <p className="text-xl font-bold text-white tv:text-3xl">Something went wrong</p>
            <p className="max-w-md text-sm text-neutral-400 tv:text-xl">{error || "Please try again."}</p>
            <Button onClick={createChallenge} className="btn-brand mt-2 h-12 px-8 tv:h-16 tv:px-16 tv:text-2xl">
              <RefreshCcw className="mr-2 h-5 w-5 tv:h-8 tv:w-8" />
              Try Again
            </Button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500 tv:mt-10 tv:text-lg">
          <ShieldCheck className="h-4 w-4 text-emerald-500 tv:h-6 tv:w-6" />
          <span>Your TV will stay signed in on this device.</span>
        </div>
      </div>
    </div>
  );
}