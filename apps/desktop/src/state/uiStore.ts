import { create } from "zustand";
import type { AppRouteId } from "@/types";

interface UiState {
  bootComplete: boolean;
  activeRoute: AppRouteId;
  navCollapsed: boolean;
  globalError: string | null;
  toast: string | null;
  setBootComplete: (value: boolean) => void;
  setActiveRoute: (route: AppRouteId) => void;
  setNavCollapsed: (value: boolean) => void;
  setGlobalError: (message: string | null) => void;
  setToast: (message: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  bootComplete: false,
  activeRoute: "splash",
  navCollapsed: false,
  globalError: null,
  toast: null,
  setBootComplete: (bootComplete) => set({ bootComplete }),
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setNavCollapsed: (navCollapsed) => set({ navCollapsed }),
  setGlobalError: (globalError) => set({ globalError }),
  setToast: (toast) => set({ toast }),
}));
