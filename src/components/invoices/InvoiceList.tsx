"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
  Filter,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface InvoiceItem {
  id: string;
  codigo: string;
  producto: string;
  cantidad: number;
  valorUnit: number;
  subtotal: number;
}

interface Invoice {
  id: string;
  numero: string;
  tipo: string;
  fechaEmision: string;
  proveedor: string;
  total: number;
  items: InvoiceItem[];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function InvoiceList() {
  const { refreshKey, triggerRefresh } = useAppStore();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pagina: pagina.toString(), porPagina: "15" });
      if (busqueda) params.set("busqueda", busqueda);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);

      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
      setTotalPaginas(data.totalPaginas || 1);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las facturas.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [pagina, busqueda, desde, hasta, toast]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices, refreshKey]);

  const buscar = () => { setPagina(1); fetchInvoices(); };
  const limpiarFiltros = () => { setBusqueda(""); setDesde(""); setHasta(""); setPagina(1); };

  const exportarExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/invoices/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "BaseDeDatos_CUCIMUNDO.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Excel descargado", description: "BaseDeDatos_CUCIMUNDO.xlsx se guardó en tu computadora." });
    } catch {
      toast({ title: "Error", description: "No se pudo generar el Excel.", variant: "destructive" });
    } finally { setExporting(false); }
  };

  const eliminarFactura = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Factura eliminada", description: `${deleteTarget.numero} fue eliminada.` });
      triggerRefresh();
      setDeleteTarget(null);
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-5 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Consultar facturas</h2>
          <p className="text-sm text-stone-500 mt-0.5">Buscá por número, producto o fecha</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportarExcel} disabled={exporting} className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
          <Download className={`w-4 h-4 ${exporting ? "animate-pulse" : ""}`} />
          <span className="hidden sm:inline">{exporting ? "Descargando..." : "Exportar Base de Datos"}</span>
        </Button>
      </div>

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Buscar por número, descripción o producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()} className="h-11 pl-10 text-base" />
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={`h-11 gap-2 ${showFilters ? "bg-emerald-50 border-emerald-300 text-emerald-700" : ""}`}>
          <Filter className="w-4 h-4" /><span className="hidden sm:inline">Fechas</span>
        </Button>
        <Button onClick={buscar} className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-200 gap-2">
          <Search className="w-4 h-4" /> Buscar
        </Button>
      </div>

      {showFilters && (
        <Card className="border-0 shadow-sm animate-in slide-in-from-top-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-stone-700">Filtrar por fecha</p>
              <button onClick={limpiarFiltros} className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 cursor-pointer"><X className="w-3 h-3" /> Limpiar</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs text-stone-500">Desde</label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-10" /></div>
              <div className="space-y-1"><label className="text-xs text-stone-500">Hasta</label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-10" /></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-stone-100 animate-pulse" />)}</div>
      ) : invoices.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-stone-100 flex items-center justify-center"><FileText className="w-7 h-7 text-stone-400" /></div>
            <h3 className="font-semibold text-stone-900 mb-1">No se encontraron facturas</h3>
            <p className="text-sm text-stone-500">Probá con otra búsqueda o importá facturas desde la pestaña "Importar".</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Card key={inv.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-stone-900">{inv.numero}</p>
                        {inv.tipo && <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-stone-100">{inv.tipo}</Badge>}
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">{formatDate(inv.fechaEmision)} | {inv.items.length} producto(s) | {inv.items.reduce((s, i) => s + i.cantidad, 0)} unidades</p>
                      <div className="mt-2 space-y-0.5">
                        {inv.items.slice(0, 4).map((item) => (
                          <p key={item.id} className="text-xs text-stone-500">
                            <span className="text-stone-400">{item.cantidad}x</span>{" "}
                            {item.producto}{" "}
                            <span className="text-stone-400">- {formatMoney(item.subtotal)}</span>
                          </p>
                        ))}
                        {inv.items.length > 4 && (
                          <p className="text-xs text-emerald-600 font-medium">+{inv.items.length - 4} producto(s) más...</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <p className="font-bold text-lg text-stone-900">{formatMoney(inv.total)}</p>
                    <button onClick={() => setDeleteTarget(inv)} className="text-stone-400 hover:text-rose-600 transition-colors p-1 cursor-pointer" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1} className="gap-1"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
              <span className="text-sm text-stone-600">Página {pagina} de {totalPaginas}</span>
              <Button variant="outline" size="sm" onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas} className="gap-1">Siguiente <ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar factura</AlertDialogTitle>
            <AlertDialogDescription>Estás por eliminar <strong>{deleteTarget?.numero}</strong> del {deleteTarget ? formatDate(deleteTarget.fechaEmision) : ""}. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminarFactura} disabled={deleting} className="bg-rose-600 hover:bg-rose-700 text-white">{deleting ? "Eliminando..." : "Sí, eliminar"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}