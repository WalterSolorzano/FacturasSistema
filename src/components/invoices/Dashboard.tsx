"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Users,
  DollarSign,
  Package,
  TrendingUp,
  ArrowUpRight,
  Upload,
  Search,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore, type Tab } from "@/lib/store";

interface Stats {
  totalFacturas: number;
  totalFacturado: number;
  clientesUnicos: number;
  totalProductos: number;
  facturasHoy: number;
  totalHoy: number;
  ultimasFacturas: {
    id: string;
    numero: string;
    tipo: string;
    fechaEmision: string;
    cliente: string;
    total: number;
    items: { producto: string; cantidad: number }[];
  }[];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  color: string;
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
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  title,
  description,
  tab,
  icon,
  loading,
}: {
  title: string;
  description: string;
  tab: string;
  icon: React.ReactNode;
  loading?: boolean;
}) {
  const { setActiveTab } = useAppStore();
  const { toast } = useToast();

  const handleClick = () => {
    if (tab === "export") {
      fetch("/api/invoices/export")
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.blob();
        })
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "BaseDeDatos_Facturas.xlsx";
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          toast({
            title: "Excel descargado",
            description: "El archivo BaseDeDatos_Facturas.xlsx se guardó en tu computadora.",
          });
        })
        .catch(() => {
          toast({
            title: "Error al exportar",
            description: "No se pudo generar el archivo Excel.",
            variant: "destructive",
          });
        });
      return;
    }
    setActiveTab(tab as Tab);
  };

  return (
    <button
      onClick={handleClick}
      className="text-left p-5 rounded-xl border border-stone-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-stone-100 group-hover:bg-emerald-100 flex items-center justify-center text-stone-500 group-hover:text-emerald-700 transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-stone-900">{title}</p>
        </div>
        <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-600 transition-colors" />
      </div>
      <p className="text-xs text-stone-500 leading-relaxed">{description}</p>
    </button>
  );
}

export function Dashboard() {
  const { refreshKey } = useAppStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading || !stats) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <h2 className="text-xl font-bold text-stone-900">
          Panel de control
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const tieneDatos = stats.totalFacturas > 0;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900">
            Panel de control
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Resumen general del sistema
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-5 h-5 text-white" />}
          label="Facturas registradas"
          value={stats.totalFacturas.toLocaleString("es-AR")}
          subtitle={`${stats.facturasHoy} hoy`}
          color="bg-emerald-600"
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5 text-white" />}
          label="Total facturado"
          value={formatMoney(stats.totalFacturado)}
          subtitle={stats.totalHoy > 0 ? `${formatMoney(stats.totalHoy)} hoy` : "Acumulado total"}
          color="bg-amber-500"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-white" />}
          label="Clientes"
          value={stats.clientesUnicos.toString()}
          subtitle="Clientes únicos"
          color="bg-teal-600"
        />
        <StatCard
          icon={<Package className="w-5 h-5 text-white" />}
          label="Productos vendidos"
          value={stats.totalProductos.toLocaleString("es-AR")}
          subtitle="Líneas de producto"
          color="bg-rose-500"
        />
      </div>

      {!tieneDatos ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">
              Bienvenido al sistema
            </h3>
            <p className="text-stone-500 max-w-md mx-auto mb-4">
              Aun no hay facturas registradas. Hacé clic en{" "}
              <strong>&quot;Nueva Factura&quot;</strong> arriba para registrar la
              primera.
            </p>
            <p className="text-xs text-stone-400">
              Los datos se guardan automáticamente en esta computadora.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-stone-900">
                Últimas facturas
              </h3>
              <span className="text-xs text-stone-400">
                {stats.ultimasFacturas.length} más recientes
              </span>
            </div>
            <div className="space-y-3">
              {stats.ultimasFacturas.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-stone-900 truncate">
                        {inv.numero}
                      </p>
                      <p className="text-xs text-stone-500 truncate">
                        {inv.cliente}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="font-semibold text-sm text-stone-900">
                      {formatMoney(inv.total)}
                    </p>
                    <p className="text-xs text-stone-400">
                      {formatDate(inv.fechaEmision)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickAction
          title="Importar facturas"
          description="Subí el archivo Excel con todas las hojas de factura"
          tab="importar"
          icon={<Upload className="w-5 h-5" />}
        />
        <QuickAction
          title="Buscar facturas"
          description="Encontrá cualquier factura por número, cliente o fecha"
          tab="consultar"
          icon={<Search className="w-5 h-5" />}
        />
        <QuickAction
          title="Exportar a Excel"
          description="Descargá toda la base de datos en formato Excel con resumen incluido"
          tab="export"
          icon={<Download className="w-5 h-5" />}
        />
      </div>
    </div>
  );
}