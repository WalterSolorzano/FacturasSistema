import { create } from "zustand";

export type Tab = "dashboard" | "importar" | "lotes" | "consultar" | "crear" | "estadisticas" | "bases";

export interface ProjectInfo {
  id: string;
  nombre: string;
  createdAt: string;
  _count: { invoices: number };
}

interface AppState {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  projects: ProjectInfo[];
  setProjects: (p: ProjectInfo[]) => void;
  refreshKey: number;
  triggerRefresh: () => void;
  invoiceToEdit: any | null;
  setInvoiceToEdit: (inv: any | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "dashboard",
  setActiveTab: (tab) => set({ activeTab: tab }),
  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  projects: [],
  setProjects: (p) => set({ projects: p }),
  refreshKey: 0,
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
  invoiceToEdit: null,
  setInvoiceToEdit: (inv) => set({ invoiceToEdit: inv }),
}));