"use client";

import { AppHeader } from "@/components/invoices/AppHeader";
import { Dashboard } from "@/components/invoices/Dashboard";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { InvoiceList } from "@/components/invoices/InvoiceList";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const { activeTab } = useAppStore();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "nueva" && <InvoiceForm />}
        {activeTab === "consultar" && <InvoiceList />}
      </main>
      <footer className="border-t border-stone-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <p className="text-xs text-stone-400 text-center">
            Registro de Facturas - Los datos se guardan localmente en esta
            computadora
          </p>
        </div>
      </footer>
    </div>
  );
}