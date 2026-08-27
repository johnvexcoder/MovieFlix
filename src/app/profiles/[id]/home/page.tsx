"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Film, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroBanner } from "@/components/home/hero-banner";
import { ContentRow } from "@/components/home/content-row";
import { NetflixNavbar } from "@/components/layout/netflix-navbar";
import { AccountCountdownBanner } from "@/components/account/account-countdown-banner";
import type { Profile, HomeData, MediaWithProgress } from "@/types";

interface MeResponse extends Profile {
  accountExpiresAt: string | null;
  accountCreatedAt: string | null;
  accountUsername: string;
}

export default function ProfileHomePage() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accountExpiresAt, setAccountExpiresAt] = useState<string | null>(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [accountUsername, setAccountUsername] = useState<string>("");
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [profileId]);

  useEffect(() => {
    if (profile) {
      fetchHomeData();
    }
  }, [profile]);

  async function checkAuth() {
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();

      if (data.success && data.data) {
        const profileData = data.data as MeResponse;
        if (profileData.id !== profileId) {
          router.push("/profiles");
          return;
        }
        setProfile(profileData);
        setAccountExpiresAt(profileData.accountExpiresAt || null);
        setAccountCreatedAt(profileData.accountCreatedAt || null);
        setAccountUsername(profileData.accountUsername || profileData.name);
      } else {
        router.push("/login");
      }
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function fetchHomeData() {
    try {
      const response = await fetch("/api/home");
      const data = await response.json();
      if (data.success) {
        setHomeData(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch home data:", error);
    }
  }

  if (loading) {
    return (
      <div className="cinematic-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const featured = homeData?.featured;
  const continueWatching = (homeData?.continueWatching as MediaWithProgress[]) || [];
  const recentlyAdded = homeData?.recentlyAdded || [];
  const trending = homeData?.trending || [];
  const genres = homeData?.genres || {};

  const progressMap: Record<string, number> = {};
  for (const item of continueWatching) {
    if (item.progress) {
      progressMap[item.id] = item.progress.percent;
    }
  }

  const newReleases = homeData?.newReleases || [];
  const carouselItems = newReleases.length > 0 ? newReleases : (featured ? [featured] : []);

  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      {/* Trial Countdown Banner if applicable */}
      {accountExpiresAt && (
        <div className="relative z-50">
          <AccountCountdownBanner
            expiresAt={accountExpiresAt}
            startedAt={accountCreatedAt}
            username={accountUsername}
          />
        </div>
      )}

      {/* Floating Netflix Navbar */}
      <NetflixNavbar profile={profile} accountExpiresAt={accountExpiresAt} />

      {/* Main Container */}
      <main className="relative pb-24">
        {/* Cinematic Hero Spotlight (48h Newly Added Carousel) */}
        {carouselItems.length > 0 ? (
          <HeroBanner items={carouselItems} profileId={profileId} />
        ) : (
          <div className="pt-24" />
        )}

        {/* Content Rows with Negative Margin for Depth Overlay */}
        <div className={`relative z-20 space-y-10 sm:space-y-12 px-4 sm:px-8 md:px-12 ${carouselItems.length > 0 ? "-mt-24 md:-mt-36" : "mt-6"}`}>
          {/* 1. Continue Watching (if any in progress) */}
          {continueWatching.length > 0 && (
            <ContentRow
              title="Continue Watching"
              items={continueWatching}
              profileId={profileId}
              showProgress={true}
              progressMap={progressMap}
            />
          )}

          {/* 2. Trending Now in Vault */}
          {trending.length > 0 && (
            <ContentRow
              title="Trending Now"
              items={trending}
              profileId={profileId}
            />
          )}

          {/* 3. Recently Added to Media Vault */}
          {recentlyAdded.length > 0 && (
            <ContentRow
              title="Recently Added"
              items={recentlyAdded}
              profileId={profileId}
            />
          )}

          {/* 4. Genre Rows */}
          {Object.entries(genres).map(([genre, items]) => (
            <ContentRow
              key={genre}
              title={genre}
              items={items}
              profileId={profileId}
              categoryType={genre}
            />
          ))}

          {/* Empty State when no media scanned yet */}
          {carouselItems.length === 0 && continueWatching.length === 0 && recentlyAdded.length === 0 && (
            <div className="my-16 mx-auto max-w-xl rounded-3xl border border-white/10 bg-[#121215] p-12 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-[#e50914] ring-1 ring-red-500/30">
                <Film className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold text-white">Media Vault is Empty</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Configure your media library paths in the Admin Panel and run a scan to start streaming movies and series.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button
                  onClick={fetchHomeData}
                  className="btn-brand rounded-xl"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
