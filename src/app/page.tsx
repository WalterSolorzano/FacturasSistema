"use client";

import { AppHeader } from "@/components/invoices/AppHeader";
import { Dashboard } from "@/components/invoices/Dashboard";
import { Importar } from "@/components/invoices/Importar";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const { activeTab } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "importar" && <Importar />}
        {activeTab === "consultar" && <InvoiceList />}
      </main>
      <footer className="border-t border-stone-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <p className="text-xs text-stone-400 text-center">
            Registro de Facturas - Importá tu Excel, consultá y exportá
          </p>
        </div>
      </footer>
    </div>
  );
}