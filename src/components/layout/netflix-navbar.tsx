"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LogOut,
  User,
  Shield,
  Film,
  Tv,
  Sparkles,
  ChevronDown,
  X,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { MovieFlixLogo } from "@/components/movieflix-logo";
import type { Profile } from "@/types";

interface NetflixNavbarProps {
  profile: Profile;
  accountExpiresAt?: string | null;
}

export function NetflixNavbar({ profile, accountExpiresAt }: NetflixNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileDropdown, setProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const profileId = profile.id;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/profiles/${profileId}/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const navLinks = [
    { label: "Home", href: `/profiles/${profileId}/home` },
    { label: "Movies", href: `/profiles/${profileId}/browse?type=movie` },
    { label: "TV Series", href: `/profiles/${profileId}/browse?type=series` },
    { label: "Browse All", href: `/profiles/${profileId}/browse` },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        isScrolled
          ? "bg-[#08080a]/92 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl shadow-black/80"
          : "bg-gradient-to-b from-[#08080a]/90 via-[#08080a]/40 to-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 md:h-20 items-center justify-between px-4 sm:px-8 md:px-12">
        {/* Left Side: Logo & Navigation */}
        <div className="flex items-center gap-6 md:gap-10">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => router.push(`/profiles/${profileId}/home`)}
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <MovieFlixLogo className="h-8 w-8 transition-transform duration-300 group-hover:scale-105" size={32} />
            <span className="text-xl md:text-2xl font-black tracking-tight text-white transition-opacity group-hover:opacity-90">
              Movie<span className="text-[#e50914]">Flix</span>
            </span>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => router.push(link.href)}
                  className={`relative px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200 rounded-full ${
                    isActive
                      ? "text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 -z-10 rounded-full bg-white/10"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Search, Account Expiry, Profile Dropdown */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Interactive Search Bar */}
          <div className="relative flex items-center">
            <AnimatePresence>
              {searchOpen ? (
                <motion.form
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "240px", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  onSubmit={handleSearchSubmit}
                  className="flex items-center overflow-hidden rounded-full border border-white/20 bg-black/60 backdrop-blur-md"
                >
                  <Search className="ml-3 h-4 w-4 text-neutral-400 shrink-0" />
                  <input
                    type="search"
                    placeholder="Titles, people, genres…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full bg-transparent px-2.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="mr-2 p-1 text-neutral-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.form>
              ) : (
                <button
                  type="button"
                  aria-label="Search"
                  onClick={() => setSearchOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}
            </AnimatePresence>
          </div>

          {/* Profile Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdown(!profileDropdown)}
              className="flex items-center gap-2 rounded-full p-1 transition-all duration-200 hover:ring-2 hover:ring-white/30"
            >
              <ProfileAvatar
                avatarUrl={profile.avatarUrl}
                name={profile.name}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl shadow-md"
                emojiClassName="text-xl"
              />
              <ChevronDown
                className={`h-4 w-4 text-neutral-400 transition-transform duration-200 ${
                  profileDropdown ? "rotate-180 text-white" : ""
                }`}
              />
            </button>

            {/* Dropdown Card */}
            <AnimatePresence>
              {profileDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="glass-panel absolute right-0 mt-3 w-56 rounded-2xl p-2 shadow-2xl border border-white/15 z-50"
                >
                  <div className="flex items-center gap-3 p-2.5 border-b border-white/10">
                    <ProfileAvatar
                      avatarUrl={profile.avatarUrl}
                      name={profile.name}
                      className="h-9 w-9 rounded-xl"
                      emojiClassName="text-xl"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {profile.name}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Active Profile
                      </p>
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdown(false);
                        router.push("/profiles");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <User className="h-4 w-4 text-neutral-400" />
                      Switch Profile
                    </button>
                  </div>

                  <div className="pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
