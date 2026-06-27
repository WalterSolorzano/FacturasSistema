"use client";

import { AppHeader } from "@/components/invoices/AppHeader";
import { Dashboard } from "@/components/invoices/Dashboard";
import { Importar } from "@/components/invoices/Importar";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { useAppStore } from "@/lib/store";
import { FolderOpen } from "lucide-react";

export default function Home() {
  const { activeTab, activeProjectId, projects, setActiveTab } = useAppStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Si el tab requiere proyecto pero no hay uno seleccionado, mostrar selector
  const needsProject = activeTab !== "dashboard" && !activeProjectId;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {needsProject ? (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-purple-700" />
            </div>
            <h2 className="text-lg font-bold text-stone-900 mb-1">Seleccioná un proyecto</h2>
            <p className="text-sm text-stone-500 text-center max-w-sm">
              Elegí un proyecto del menú de arriba o creá uno nuevo para empezar a trabajar.
            </p>
            <button
              onClick={() => setActiveTab("dashboard")}
              className="mt-4 text-sm text-purple-700 hover:text-purple-800 font-medium cursor-pointer"
            >
              Volver al inicio
            </button>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "importar" && <Importar />}
            {activeTab === "crear" && <InvoiceForm />}
            {activeTab === "consultar" && <InvoiceList />}
          </>
        )}
      </main>
      <footer className="border-t border-stone-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <p className="text-xs text-stone-400 text-center">
            Facturas — Registro y consulta
          </p>
        </div>
      </footer>
    </div>
  );
}