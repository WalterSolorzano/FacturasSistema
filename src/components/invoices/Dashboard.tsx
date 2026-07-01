"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  DollarSign,
  Package,
  TrendingUp,
  ArrowUpRight,
  Upload,
  Search,
  Download,
  Hash,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore, type Tab } from "@/lib/store";
import { ExportModal } from "./ExportModal";

interface Stats {
  totalFacturas: number;
  totalFacturado: number;
  proveedoresUnicos: number;
  totalProductos: number;
  totalUnidades: number;
  facturasMes: number;
  totalMes: number;
  ultimasFacturas: {
    id: string;
    numero: string;
    tipo: string;
    fechaEmision: string;
    proveedor: string;
    total: number;
    hojaOrigen: string;
    advertencias: string;
    items: { producto: string; cantidad: number }[];
  }[];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (date.getFullYear() === 1970) return "Sin fecha";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function StatCard({ icon, label, value, subtitle, color }: {
  icon: React.ReactNode; label: string; value: string; subtitle: string; color: string;
}) {
  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-500">{label}</p>
            <p className="text-2xl font-bold text-stone-900">{value}</p>
            <p className="text-xs text-stone-400">{subtitle}</p>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ title, description, tab, icon, needsProject, onClickAction }: {
  title: string; description: string; tab: string; icon: React.ReactNode; needsProject?: boolean; onClickAction?: () => void;
}) {
  const { setActiveTab } = useAppStore();
  const { toast } = useToast();

  const handleClick = () => {
    if (onClickAction) {
      onClickAction();
      return;
    }
    setActiveTab(tab as Tab);
  };

  return (
    <button onClick={handleClick} className="text-left p-5 rounded-xl border border-stone-200 bg-white hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-stone-100 group-hover:bg-purple-100 flex items-center justify-center text-stone-500 group-hover:text-purple-800 transition-colors">{icon}</div>
        <p className="font-medium text-sm text-stone-900 flex-1">{title}</p>
        <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-purple-700 transition-colors" />
      </div>
      <p className="text-xs text-stone-500 leading-relaxed">{description}</p>
    </button>
  );
}

export function Dashboard() {
  const { refreshKey, activeProjectId, projects } = useAppStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = activeProjectId ? `?projectId=${activeProjectId}` : "";
    fetch(`/api/stats${params}`).then((r) => {
      if (!r.ok) throw new Error("Stats failed");
      return r.json();
    }).then((data) => { if (!cancelled) { setStats(data); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey, activeProjectId]);

  if (loading || !stats) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-stone-900">Panel de control</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Card key={i} className="border-0 shadow-sm"><CardContent className="p-5 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /><Skeleton className="h-3 w-20" /></CardContent></Card>)}</div>
      </div>
    );
  }

  const tieneDatos = stats.totalFacturas > 0;
  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject = safeProjects.find((p) => p.id === activeProjectId);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-xl font-bold text-stone-900">Panel de control</h2>
        <p className="text-sm text-stone-500 mt-0.5">
          {activeProject ? `Proyecto: ${activeProject.nombre}` : "Todos los proyectos"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FileText className="w-5 h-5 text-white" />} label="Facturas registradas" value={stats.totalFacturas.toLocaleString("es-AR")} subtitle={`${stats.facturasMes} este mes`} color="bg-purple-800" />
        <StatCard icon={<DollarSign className="w-5 h-5 text-white" />} label="Total facturado" value={formatMoney(stats.totalFacturado)} subtitle={stats.totalMes > 0 ? `${formatMoney(stats.totalMes)} este mes` : "Acumulado total"} color="bg-sky-600" />
        <StatCard icon={<Hash className="w-5 h-5 text-white" />} label="Unidades vendidas" value={stats.totalUnidades.toLocaleString("es-AR")} subtitle={`${stats.totalProductos} líneas de producto`} color="bg-teal-600" />
        <StatCard icon={<Package className="w-5 h-5 text-white" />} label="Ticket promedio" value={formatMoney(stats.totalFacturas > 0 ? stats.totalFacturado / stats.totalFacturas : 0)} subtitle="Promedio por factura" color="bg-rose-500" />
      </div>

      {!tieneDatos ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center"><TrendingUp className="w-8 h-8 text-purple-700" /></div>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">
              {activeProject ? "Sin facturas en este proyecto" : "Bienvenido al sistema"}
            </h3>
            <p className="text-stone-500 max-w-md mx-auto mb-4">
              {activeProject
                ? "Importá tu archivo Excel o creá facturas manualmente."
                : "Creá un proyecto desde el menú de arriba para empezar a registrar facturas."
              }
            </p>
            <p className="text-xs text-stone-400">Los datos se guardan localmente en esta computadora. No se inventa ningún dato.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-stone-900">Últimas facturas</h3>
              <span className="text-xs text-stone-400">{stats.ultimasFacturas.length} más recientes</span>
            </div>
            <div className="space-y-3">
              {stats.ultimasFacturas.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-purple-800" /></div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-stone-900 truncate">{inv.numero}</p>
                      <p className="text-xs text-stone-500 truncate">{inv.proveedor || "(sin cliente)"} | {inv.items.length} prod. | {inv.items.reduce((s, i) => s + i.cantidad, 0)} uds.</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="font-semibold text-sm text-stone-900">{formatMoney(inv.total)}</p>
                    <p className="text-xs text-stone-400">{formatDate(inv.fechaEmision)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction title="Importar facturas" description="Subí el archivo Excel con todas las hojas" tab="importar" icon={<Upload className="w-5 h-5" />} needsProject />
        <QuickAction title="Crear factura" description="Ingresá una factura manualmente" tab="crear" icon={<Plus className="w-5 h-5" />} needsProject />
        <QuickAction title="Buscar facturas" description="Buscá por número, producto o fecha" tab="consultar" icon={<Search className="w-5 h-5" />} needsProject />
        <QuickAction title="Exportar" description="Exportá en Base de Datos o Plantilla" tab="export" icon={<Download className="w-5 h-5" />} onClickAction={() => setShowExportModal(true)} />
      </div>

      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
}