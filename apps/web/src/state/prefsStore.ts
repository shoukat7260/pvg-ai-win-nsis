import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface PrefsState {
  marketingBannerDismissed: boolean;
  setBannerDismissed: (v: boolean) => void;
}

/**
 * Persisted preferences only — never tokens, secrets, or session material.
 */
export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      marketingBannerDismissed: false,
      setBannerDismissed: (marketingBannerDismissed) =>
        set({ marketingBannerDismissed }),
    }),
    {
      name: "pvg-web-prefs",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        marketingBannerDismissed: s.marketingBannerDismissed,
      }),
    },
  ),
);
