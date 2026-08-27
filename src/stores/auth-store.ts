import { create } from "zustand";
import type { Profile } from "@/types";

interface AuthState {
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setProfile: (profile: Profile) => void;
  clearProfile: () => void;
  setLoading: (loading: boolean) => void;
  fetchProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  isAuthenticated: false,
  isLoading: true,

  setProfile: (profile) =>
    set({ profile, isAuthenticated: true, isLoading: false }),

  clearProfile: () =>
    set({ profile: null, isAuthenticated: false, isLoading: false }),

  setLoading: (isLoading) => set({ isLoading }),

  fetchProfile: async () => {
    try {
      set({ isLoading: true });
      const response = await fetch("/api/auth/me");
      const data = await response.json();

      if (data.success && data.data) {
        set({ profile: data.data as Profile, isAuthenticated: true, isLoading: false });
      } else {
        set({ profile: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ profile: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      set({ profile: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
