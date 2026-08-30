"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Plus,
  Pen,
  Trash2,
  Lock,
  LogOut,
  Search,
  ChevronLeft,
  Check,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Profile } from "@/types";
import {
  AVATAR_OPTIONS,
  AVATAR_CATEGORIES,
  AVATAR_CATEGORY_LABELS,
} from "@/lib/avatars";
import { ProfileAvatar } from "@/components/profile-avatar";
import { MovieFlixLogo } from "@/components/movieflix-logo";
import { refreshUserSession } from "@/lib/client-auth";

interface ProfileWithPin extends Profile {
  hasPin: boolean;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e50914]"
      style={{ backgroundColor: checked ? "#e50914" : "rgba(255,255,255,0.15)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}

function AvatarBrowser({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [category, setCategory] = useState<null | (typeof AVATAR_CATEGORIES)[number]>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AVATAR_OPTIONS.filter((option) => {
      if (category && option.category !== category) return false;
      if (q && !option.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, query]);

  const groups = useMemo(() => {
    if (category || query) return [{ label: null, items: filtered }];
    return AVATAR_CATEGORIES.map((cat) => ({
      label: AVATAR_CATEGORY_LABELS[cat],
      items: filtered.filter((o) => o.category === cat),
    }));
  }, [category, query, filtered]);

  return (
    <div>
      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
            category === null
              ? "bg-[#e50914] text-white shadow-md shadow-red-950/50"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
          }`}
        >
          All
        </button>
        {AVATAR_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              category === cat
                ? "bg-[#e50914] text-white shadow-md shadow-red-950/50"
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            }`}
          >
            {AVATAR_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          className="rounded-xl border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-neutral-500"
        />
      </div>

      {/* Grid */}
      <div className="mt-4 max-h-[300px] space-y-4 overflow-y-auto pr-1">
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.label ?? "results"}>
              {group.label && (
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
                  {group.label}
                </p>
              )}
              <div className="grid grid-cols-6 gap-2.5 sm:grid-cols-8">
                {group.items.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.label}
                    onClick={() => onSelect(option.id)}
                    className={`aspect-square overflow-hidden rounded-xl transition-all duration-200 hover:scale-110 ${
                      value === option.id
                        ? "scale-105 ring-2 ring-[#e50914] ring-offset-2 ring-offset-[#121215] shadow-lg shadow-red-950/50"
                        : "opacity-75 hover:opacity-100"
                    }`}
                  >
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{
                        backgroundImage: `linear-gradient(135deg, ${option.from}, ${option.to})`,
                      }}
                    >
                      <span className="text-2xl drop-shadow-md">{option.emoji}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        )}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">
            No avatars found for “{query}”.
          </p>
        )}
      </div>

      {value && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mt-3 text-xs font-medium text-neutral-400 transition-colors hover:text-white"
        >
          Remove icon (use initial letter)
        </button>
      )}
    </div>
  );
}

export default function ProfilesPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<ProfileWithPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCreateMore, setCanCreateMore] = useState(true);
  const [manageMode, setManageMode] = useState(false);

  // Add profile state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState<"details" | "picture">("details");
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Edit profile state
  const [editProfile, setEditProfile] = useState<ProfileWithPin | null>(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [editPin, setEditPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // PIN entry modal state
  const [pinModal, setPinModal] = useState<{
    open: boolean;
    profile: ProfileWithPin | null;
  }>({ open: false, profile: null });
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoggingIn, setPinLoggingIn] = useState(false);

  // Mobile-friendly banner for session rejection (another device on this profile, or account cap reached)
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    try {
      const data = await getProfiles();
      if (data.success) {
        setProfiles(data.data.profiles);
        setCanCreateMore(data.data.canCreateMore);
      } else {
        const refreshed = await refreshUserSession();
        if (refreshed) {
          const retry = await getProfiles();
          if (retry.success) {
            setProfiles(retry.data.profiles);
            setCanCreateMore(retry.data.canCreateMore);
          } else {
            router.push("/login");
          }
        } else {
          router.push("/login");
        }
      }
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function getProfiles() {
    const response = await fetch("/api/account/profiles", { cache: "no-store" });
    return response.json();
  }

  function openAddModal() {
    setAddStep("details");
    setNewName("");
    setNewPin("");
    setNewAvatar(AVATAR_OPTIONS[0].id);
    setAddModalOpen(true);
  }

  async function handleAddProfile() {
    if (!newName.trim()) return;

    setAdding(true);
    try {
      const response = await fetch("/api/account/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          pin: newPin || null,
          avatarUrl: newAvatar,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAddModalOpen(false);
        fetchProfiles();
      } else {
        alert(data.error || "Failed to create profile");
      }
    } catch {
      alert("Failed to create profile");
    } finally {
      setAdding(false);
    }
  }

  function openEdit(profile: ProfileWithPin) {
    setEditProfile(profile);
    setEditName(profile.name);
    setEditAvatar(profile.avatarUrl);
    setPinEnabled(profile.hasPin);
    setEditPin("");
  }

  async function handleSaveProfile() {
    if (!editProfile || !editName.trim()) return;
    if (pinEnabled && !editProfile.hasPin && editPin.length !== 4) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: editName.trim() };
      body.avatarUrl = editAvatar;

      if (!pinEnabled) {
        body.pin = null;
      } else if (editPin.length === 4) {
        body.pin = editPin;
      }

      const response = await fetch(`/api/profiles/${editProfile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setEditProfile(null);
        fetchProfiles();
      } else {
        alert(data.error || "Failed to update profile");
      }
    } catch {
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProfile() {
    if (!editProfile) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/profiles/${editProfile.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        setEditProfile(null);
        setDeleting(false);
        fetchProfiles();
      } else {
        setDeleting(false);
        alert(data.error || "Failed to delete profile");
      }
    } catch {
      setDeleting(false);
      alert("Failed to delete profile");
    }
  }

  async function handleSelectProfile(profile: ProfileWithPin) {
    if (manageMode) {
      openEdit(profile);
      return;
    }

    if (profile.hasPin) {
      setPinDigits(["", "", "", ""]);
      setPinError(null);
      setPinModal({ open: true, profile });
    } else {
      loginToProfile(profile.id);
    }
  }

  async function loginToProfile(profileId: string, pin?: string) {
    setPinLoggingIn(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/auth/profile-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, pin }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/profiles/${profileId}/home`);
      } else {
        // Session rejected (409 profile in use / 429 account cap) or bad PIN.
        if (response.status === 409) {
          setPinModal({ open: false, profile: null });
          setLoginError(
            data.error ||
              "This profile is already in use on another device. Select another profile to continue."
          );
        } else if (response.status === 429) {
          setPinModal({ open: false, profile: null });
          setLoginError(data.error || "Too many active sessions. Please try again later.");
        } else {
          setPinError(data.error || "Incorrect PIN code");
          setPinDigits(["", "", "", ""]);
        }
      }
    } catch {
      setPinError("Failed to connect to server");
    } finally {
      setPinLoggingIn(false);
    }
  }

  const handlePinDigitChange = (index: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...pinDigits];
    next[index] = val;
    setPinDigits(next);

    if (val && index < 3) {
      const nextInput = document.getElementById(`pin-digit-${index + 1}`);
      nextInput?.focus();
    }

    // If 4 digits entered, auto-submit
    if (val && index === 3 && next.every((d) => d.length === 1)) {
      const fullPin = next.join("");
      if (pinModal.profile) {
        loginToProfile(pinModal.profile.id, fullPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      const prevInput = document.getElementById(`pin-digit-${index - 1}`);
      prevInput?.focus();
    }
  };

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="cinematic-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#e50914]" />
      </div>
    );
  }

  return (
    <div className="cinematic-bg relative flex min-h-screen flex-col items-center justify-center px-4 py-12 select-none">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/3 left-1/2 h-[550px] w-[550px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[160px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-5xl"
      >
        {/* Header */}
        <div className="mb-12 text-center flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 p-2 shadow-2xl ring-1 ring-white/10">
            <MovieFlixLogo className="h-12 w-12" size={48} />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white">
            Who&apos;s Watching?
          </h1>
          <p className="mt-2.5 text-base sm:text-lg text-neutral-400">
            Select your profile or enter your secure PIN to continue.
          </p>
        </div>

        {/* Session rejection banner */}
        <AnimatePresence>
          {loginError && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto mb-6 flex max-w-xl items-center gap-3 rounded-2xl border border-red-500/40 bg-red-950/60 p-4 text-sm font-semibold text-red-200 backdrop-blur-md"
            >
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />
              <span className="flex-1">{loginError}</span>
              <button
                type="button"
                onClick={() => setLoginError(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-neutral-300 transition-colors hover:bg-white/20 hover:text-white"
              >
                <Check className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profiles Grid */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 md:gap-10">
          {profiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.4 }}
              className="group relative flex flex-col items-center"
            >
              <div
                className="relative h-32 w-32 sm:h-36 sm:w-36 md:h-44 md:w-44 cursor-pointer overflow-hidden rounded-2xl border-2 border-transparent transition-all duration-300 group-hover:scale-105 group-hover:border-white/80 group-hover:shadow-[0_0_30px_rgba(229,9,20,0.5)] active:scale-95"
                onClick={() => handleSelectProfile(profile)}
              >
                <ProfileAvatar
                  avatarUrl={profile.avatarUrl}
                  name={profile.name}
                  className="h-full w-full rounded-2xl"
                  emojiClassName="text-5xl md:text-6xl"
                />

                {/* PIN Protected Badge */}
                {profile.hasPin && (
                  <div className="absolute top-2.5 left-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/70 backdrop-blur-md shadow-md">
                    <Lock className="h-4 w-4 text-white" />
                  </div>
                )}

                {/* Hover overlay with action label */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold text-white tracking-wide uppercase backdrop-blur-md">
                    {manageMode ? "Edit" : profile.hasPin ? "Enter PIN" : "Enter"}
                  </span>
                </div>
              </div>

              {/* Edit Pencil icon */}
              <button
                type="button"
                aria-label={`Edit ${profile.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(profile);
                }}
                className="absolute -top-2 -right-2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-neutral-900/90 text-white shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-115 hover:bg-[#e50914] hover:border-transparent opacity-80 md:opacity-0 group-hover:opacity-100"
              >
                <Pen className="h-4 w-4" />
              </button>

              <p className="mt-3 text-center text-base sm:text-lg font-semibold tracking-wide text-neutral-300 transition-colors duration-200 group-hover:text-white">
                {profile.name}
              </p>
            </motion.div>
          ))}

          {/* Add Profile Tile */}
          {canCreateMore && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: profiles.length * 0.08, duration: 0.4 }}
              className="group flex flex-col items-center"
            >
              <button
                type="button"
                onClick={openAddModal}
                className="flex h-32 w-32 sm:h-36 sm:w-36 md:h-44 md:w-44 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 transition-all duration-300 hover:border-white/60 hover:bg-white/10 hover:scale-105 active:scale-95"
              >
                <Plus className="h-12 w-12 text-white/40 transition-colors duration-200 group-hover:text-white" />
              </button>
              <p className="mt-3 text-center text-base sm:text-lg font-semibold tracking-wide text-neutral-400 transition-colors duration-200 group-hover:text-white">
                Add Profile
              </p>
            </motion.div>
          )}
        </div>

        {/* Action Controls (Manage Profiles / Sign Out) */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-4">
          <Button
            variant="outline"
            className="rounded-xl border-white/20 bg-white/5 px-6 py-2.5 text-sm font-semibold tracking-wider uppercase text-neutral-300 backdrop-blur-md transition-all hover:border-white/50 hover:bg-white/15 hover:text-white"
            onClick={() => setManageMode(!manageMode)}
          >
            {manageMode ? "Done Managing" : "Manage Profiles"}
          </Button>

          <Button
            variant="ghost"
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-neutral-400 hover:bg-white/5 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </motion.div>

      {/* PIN Entry Modal */}
      <Dialog
        open={pinModal.open}
        onOpenChange={(open) => {
          setPinModal({ open, profile: null });
          setPinDigits(["", "", "", ""]);
          setPinError(null);
        }}
      >
        <DialogContent className="glass-panel border-white/15 sm:max-w-md rounded-3xl p-8">
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl font-bold text-white text-center">
              Profile Lock
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-400 text-center">
              Enter your 4-digit PIN to access <strong className="text-white">{pinModal.profile?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 flex flex-col items-center">
            <div className="mb-6 flex justify-center">
              <ProfileAvatar
                avatarUrl={pinModal.profile?.avatarUrl}
                name={pinModal.profile?.name ?? "Profile"}
                className="h-20 w-20 rounded-2xl ring-2 ring-white/20 shadow-xl"
                emojiClassName="text-4xl"
              />
            </div>

            {/* 4 Digit PIN Inputs */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((idx) => (
                <input
                  key={idx}
                  id={`pin-digit-${idx}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={pinDigits[idx]}
                  onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(idx, e)}
                  autoFocus={idx === 0}
                  className="h-14 w-12 rounded-xl border border-white/20 bg-white/5 text-center text-2xl font-bold text-white focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/40 focus:outline-none transition-all"
                />
              ))}
            </div>

            {pinError && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-red-400"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>{pinError}</span>
              </motion.div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-xl border-white/10"
              onClick={() => {
                setPinModal({ open: false, profile: null });
                setPinDigits(["", "", "", ""]);
                setPinError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="btn-brand rounded-xl px-6"
              onClick={() => {
                if (pinModal.profile) {
                  loginToProfile(pinModal.profile.id, pinDigits.join(""));
                }
              }}
              disabled={pinDigits.some((d) => d === "") || pinLoggingIn}
            >
              {pinLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Profile Modal */}
      <Dialog
        open={addModalOpen}
        onOpenChange={(open) => {
          setAddModalOpen(open);
          if (!open) setAddStep("details");
        }}
      >
        <DialogContent className={addStep === "picture" ? "glass-panel border-white/15 sm:max-w-xl rounded-3xl p-6" : "glass-panel border-white/15 sm:max-w-md rounded-3xl p-6"}>
          {addStep === "details" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">Add Profile</DialogTitle>
                <DialogDescription className="text-neutral-400">
                  Create a customized profile for this account.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-center py-4">
                <ProfileAvatar
                  avatarUrl={newAvatar}
                  name={newName.trim() || "New"}
                  className="h-28 w-28 rounded-2xl ring-2 ring-white/20 shadow-2xl"
                  emojiClassName="text-5xl"
                />
              </div>

              <div className="space-y-4 pb-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Profile Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter profile name"
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                    maxLength={30}
                    autoFocus
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">4-Digit PIN (Optional)</Label>
                  <Input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Require PIN on entry"
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white text-center font-mono tracking-widest text-lg"
                  />
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Leave blank if you want anyone on the account to open this profile.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-white/10"
                  onClick={() => setAddModalOpen(false)}
                  disabled={adding}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setAddStep("picture")}
                  disabled={!newName.trim()}
                  className="btn-brand rounded-xl"
                >
                  Choose Picture
                  <ChevronLeft className="ml-1 h-4 w-4 rotate-180" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">Choose Avatar Icon</DialogTitle>
                <DialogDescription className="text-neutral-400">
                  Pick a signature avatar for {newName.trim() || "the new profile"}.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <AvatarBrowser value={newAvatar} onSelect={setNewAvatar} />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-white/10"
                  onClick={() => setAddStep("details")}
                  disabled={adding}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleAddProfile}
                  disabled={adding || !newName.trim()}
                  className="btn-brand rounded-xl"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Create Profile
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog
        open={!!editProfile}
        onOpenChange={(open) => {
          if (!open) setEditProfile(null);
        }}
      >
        <DialogContent className="glass-panel border-white/15 sm:max-w-2xl rounded-3xl p-6">
          {editProfile && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white">Edit Profile</DialogTitle>
                <DialogDescription className="text-neutral-400">
                  Customize avatar, display name, and security PIN for {editProfile.name}.
                </DialogDescription>
              </DialogHeader>

              {/* Preview Banner */}
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <ProfileAvatar
                  avatarUrl={editAvatar}
                  name={editName.trim() || editProfile.name}
                  className="h-20 w-20 flex-shrink-0 rounded-2xl ring-2 ring-white/15 shadow-lg"
                  emojiClassName="text-4xl"
                />
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-white">
                    {editName.trim() || editProfile.name}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {editProfile.isMainProfile ? "Main Profile" : "Secondary Profile"} ·{" "}
                    {editAvatar ? "Custom Icon" : "Monogram"}
                  </p>
                </div>
              </div>

              <div className="space-y-5 py-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Profile name"
                    className="mt-1.5 h-11 rounded-xl border-white/10 bg-white/5 text-white"
                    maxLength={30}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Profile Icon</Label>
                  <div className="mt-2">
                    <AvatarBrowser value={editAvatar} onSelect={setEditAvatar} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Require PIN Protection</p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {pinEnabled
                          ? "A 4-digit PIN is required to open this profile"
                          : "Anyone with account access can enter"}
                      </p>
                    </div>
                    <Toggle checked={pinEnabled} onChange={setPinEnabled} />
                  </div>

                  {pinEnabled && (
                    <div className="mt-4">
                      <Input
                        type="password"
                        maxLength={4}
                        inputMode="numeric"
                        value={editPin}
                        onChange={(e) =>
                          setEditPin(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder={
                          editProfile.hasPin ? "Enter new 4-digit PIN" : "Enter a 4-digit PIN"
                        }
                        className="h-12 text-center text-xl font-mono tracking-widest rounded-xl border-white/15 bg-white/5 text-white"
                      />
                      <p className="mt-1.5 text-xs text-neutral-500">
                        {editProfile.hasPin
                          ? "Leave blank to keep current PIN."
                          : "Enter 4 numeric digits to enable lock."}
                      </p>
                    </div>
                  )}
                </div>

                {!editProfile.isMainProfile && (
                  <Button
                    variant="destructive"
                    className="w-full rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    onClick={handleDeleteProfile}
                    disabled={deleting || saving}
                  >
                    {deleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete Profile
                  </Button>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-white/10"
                  onClick={() => setEditProfile(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveProfile}
                  disabled={
                    saving ||
                    !editName.trim() ||
                    (pinEnabled && !editProfile.hasPin && editPin.length !== 4)
                  }
                  className="btn-brand rounded-xl"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
