import { create } from "zustand";

export type Tab = "dashboard" | "importar" | "consultar";

interface AppState {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "dashboard",
  setActiveTab: (tab) => set({ activeTab: tab }),
  refreshKey: 0,
  triggerRefresh: () =>
    set((state) => ({ refreshKey: state.refreshKey + 1 })),
}));