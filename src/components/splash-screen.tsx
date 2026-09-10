"use client";

import { useCallback, useEffect, useRef } from "react";
import { MovieFlixLogo } from "@/components/movieflix-logo";

interface SplashScreenProps {
  onComplete: () => void;
  brandName?: string;
  tagline?: string;
}

export function SplashScreen({ onComplete, brandName = "MOVIEFLIX", tagline = "STREAMING NOW" }: SplashScreenProps) {
  const completed = useRef(false);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer = window.setTimeout(finish, preference.matches ? 450 : 4400);
    const onPreference = () => {
      if (preference.matches) {
        window.clearTimeout(timer);
        timer = window.setTimeout(finish, 150);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    preference.addEventListener("change", onPreference);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      preference.removeEventListener("change", onPreference);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish]);

  return (
    <section className="movieflix-splash" aria-label="MovieFlix introduction">
      <p className="sr-only" role="status">{brandName}. {tagline}.</p>
      <div className="movieflix-lockup" aria-hidden="true">
        <div className="movieflix-intro-mark"><MovieFlixLogo className="h-full w-full" size={240}/></div>
        <div className="movieflix-wordmark-window">
          <div className="movieflix-wordmark">
            <div className="movieflix-brand-name">
              {brandName === "MOVIEFLIX" ? <><span className="movieflix-brand-cool">MOVIE</span><span className="movieflix-brand-warm">FLI<span className="movieflix-animated-x">X<span className="movieflix-x-extension" /></span></span></> : brandName}
            </div>
            <p className="movieflix-tagline">{tagline}</p>
          </div>
        </div>
      </div>
      <button type="button" className="movieflix-skip" onClick={finish}>Skip intro <span aria-hidden="true">></span></button>
    </section>
  );
}
