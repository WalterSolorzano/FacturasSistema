"use client";

import { useAppStore, type Tab } from "@/lib/store";
import { FileText, Upload, Search, LayoutDashboard } from "lucide-react";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Inicio", icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: "importar", label: "Importar", icon: <Upload className="w-5 h-5" /> },
  { id: "consultar", label: "Consultar", icon: <Search className="w-5 h-5" /> },
];

export function AppHeader() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-800 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-900 leading-tight">Facturas</h1>
              <p className="text-xs text-stone-500 leading-tight hidden sm:block">Registro y consulta</p>
            </div>
          </div>
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-purple-800 text-white shadow-md shadow-purple-200"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}