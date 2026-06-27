"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface FacturaPreview {
  numero: string;
  tipo: string;
  fecha: string;
  proveedor: string;
  productos: {
    codigo: string;
    producto: string;
    cantidad: number;
    valorUnit: number;
    subtotal: number;
  }[];
  total: number;
  hoja: string;
  errores: string[];
  exito: boolean;
}

interface ImportResult {
  facturas: FacturaPreview[];
  totalHojas: number;
  exitosas: number;
  conErrores: number;
  vacias: number;
}

function formatMoney(v: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(v);
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-AR");
}

type Paso = "subir" | "revision" | "confirmar" | "resultado";

export function Importar() {
  const { triggerRefresh, setActiveTab } = useAppStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [paso, setPaso] = useState<Paso>("subir");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedAll, setSelectedAll] = useState(true);
  const [importResult, setImportResult] = useState<{ importadas: number; duplicadas: number; errores: string[] } | null>(null);

  const procesarArchivo = useCallback(async (file: File) => {
    setLoading(true);
    setResult(null);
    setPaso("subir");

    try {
      const fd = new FormData();
      fd.append("archivo", file);

      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json() as ImportResult;
      if (!res.ok) throw new Error((data as any).error);

      setResult(data);

      // Seleccionar todas las exitosas
      const exitosasIdx = new Set<number>();
      data.facturas.forEach((f, i) => { if (f.exito) exitosasIdx.add(i); });
      setSelected(exitosasIdx);
      setSelectedAll(true);
      setPaso("revision");
    } catch (err) {
      toast({
        title: "Error al procesar",
        description: err instanceof Error ? err.message : "No se pudo leer el archivo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
  }, [procesarArchivo]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
  }, [procesarArchivo]);

  const confirmarImport = async () => {
    if (!result) return;
    const facturasAImportar = result.facturas.filter((_, i) => selected.has(i));
    if (facturasAImportar.length === 0) {
      toast({ title: "Nada que importar", description: "Seleccioná al menos una factura.", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facturas: facturasAImportar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setImportResult({ importadas: data.importadas, duplicadas: data.duplicadas, errores: data.errores || [] });
      setPaso("resultado");
      triggerRefresh();
    } catch (err) {
      toast({ title: "Error al guardar", description: err instanceof Error ? err.message : "Intentá de nuevo.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      setSelectedAll(false);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    if (selectedAll) {
      setSelected(new Set()); setSelectedAll(false);
    } else {
      const all = new Set<number>();
      result.facturas.forEach((f, i) => { if (f.exito) all.add(i); });
      setSelected(all); setSelectedAll(true);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  };

  const exitosasSeleccionadas = result ? result.facturas.filter((_, i) => selected.has(i) && result.facturas[i].exito).length : 0;

  // PASO: SUBIR ARCHIVO
  if (paso === "subir") {
    return (
      <div className="space-y-6 animate-in fade-in max-w-4xl">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Importar facturas</h2>
          <p className="text-sm text-stone-500 mt-0.5">Subí el archivo Excel con las hojas de factura</p>
        </div>

        <Card className={`border-2 border-dashed transition-all cursor-pointer ${dragOver ? "border-purple-500 bg-purple-50" : "border-stone-300 hover:border-purple-400 hover:bg-stone-50"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <CardContent className="p-10 text-center">
            {loading ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 mx-auto text-purple-700 animate-spin" />
                <p className="text-stone-600 font-medium">Leyendo hojas del archivo...</p>
                <p className="text-xs text-stone-400">Esto puede tardar unos segundos con muchas hojas</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 flex items-center justify-center"><Upload className="w-7 h-7 text-purple-700" /></div>
                <p className="text-stone-900 font-semibold">Arrastrá el archivo Excel aquí</p>
                <p className="text-sm text-stone-500">o hacé clic para seleccionarlo</p>
                <p className="text-xs text-stone-400">Acepta archivos .xlsx con una o más hojas de factura</p>
              </div>
            )}
          </CardContent>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
        </Card>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <FileSpreadsheet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800"><strong>Formato esperado:</strong> Cada hoja del Excel debe ser una factura con las columnas CANTIDAD, CODIGO, DESCRIPCION, P.UNI y TOTAL. El sistema detecta automáticamente el formato.</p>
        </div>
      </div>
    );
  }

  // PASO: RESULTADO FINAL
  if (paso === "resultado" && importResult) {
    return (
      <div className="space-y-6 animate-in fade-in max-w-4xl">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Importación completada</h2>
          <p className="text-sm text-stone-500 mt-0.5">Resultado de la importación</p>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-purple-700" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Importación exitosa</h3>
            <p className="text-3xl font-bold text-purple-700 my-3">{importResult.importadas} factura(s) importada(s)</p>
            <div className="flex justify-center gap-6 text-sm text-stone-500">
              {importResult.duplicadas > 0 && <span className="text-amber-600">{importResult.duplicadas} duplicada(s) omitida(s)</span>}
            </div>
          </CardContent>
        </Card>

        {importResult.errores.length > 0 && (
          <Card className="border border-amber-200">
            <CardContent className="p-5">
              <h4 className="font-semibold text-amber-700 mb-2">Advertencias</h4>
              <ul className="space-y-1">
                {importResult.errores.map((err, i) => <li key={i} className="text-xs text-amber-600">{err}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setPaso("subir"); setResult(null); setImportResult(null); if (fileRef.current) fileRef.current.value = ""; }}>
            Importar otro archivo
          </Button>
          <Button onClick={() => setActiveTab("consultar")} className="bg-purple-800 hover:bg-purple-900 text-white font-semibold shadow-md shadow-purple-200">
            Ver facturas importadas
          </Button>
        </div>
      </div>
    );
  }

  // PASO: REVISION + CONFIRMAR
  if (!result) return null;

  return (
    <div className="space-y-5 animate-in fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Revisar y confirmar</h2>
          <p className="text-sm text-stone-500 mt-0.5">Verificá los datos antes de guardar en la base de datos</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setPaso("subir"); setResult(null); if (fileRef.current) fileRef.current.value = ""; }}>
          Volver
        </Button>
      </div>

      {/* Barra de progreso de pasos */}
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-purple-700" /><span className="font-medium text-purple-800">Paso 1: Cargar archivo</span></div>
        <div className="w-8 h-px bg-purple-300" />
        <div className="flex items-center gap-1.5"><Eye className="w-4 h-4 text-purple-700" /><span className="font-medium text-purple-800">Paso 2: Revisar datos</span></div>
        <div className="w-8 h-px bg-stone-300" />
        <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-stone-400" /><span className="text-stone-400">Paso 3: Confirmar</span></div>
      </div>

      {/* Resumen */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <h3 className="font-semibold text-stone-900 mb-3">Resultado del análisis</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-purple-50 text-center">
              <p className="text-2xl font-bold text-purple-800">{result.exitosas}</p>
              <p className="text-xs text-purple-700">Extraídas bien</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${result.conErrores > 0 ? "bg-amber-50" : "bg-stone-50"}`}>
              <p className={`text-2xl font-bold ${result.conErrores > 0 ? "text-amber-700" : "text-stone-400"}`}>{result.conErrores}</p>
              <p className="text-xs text-amber-600">Con errores</p>
            </div>
            <div className="p-3 rounded-lg bg-stone-50 text-center">
              <p className="text-2xl font-bold text-stone-400">{result.vacias}</p>
              <p className="text-xs text-stone-500">Hojas vacías</p>
            </div>
            <div className="p-3 rounded-lg bg-stone-50 text-center">
              <p className="text-2xl font-bold text-stone-600">{result.totalHojas}</p>
              <p className="text-xs text-stone-500">Total hojas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de facturas */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedAll} onChange={toggleAll} className="w-4 h-4 rounded border-stone-300 text-purple-700 focus:ring-purple-500" />
              <span className="text-sm font-medium text-stone-700">Seleccionar todas las válidas</span>
            </label>
            <span className="text-xs text-stone-400">{exitosasSeleccionadas} seleccionada(s)</span>
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto">
            {result.facturas.map((fac, idx) => (
              <div key={idx} className={`rounded-lg border p-3 transition-colors ${fac.exito ? selected.has(idx) ? "border-purple-300 bg-purple-50/50" : "border-stone-200 bg-white hover:bg-stone-50" : "border-amber-200 bg-amber-50/50 opacity-70"}`}>
                <div className="flex items-center gap-3">
                  {fac.exito ? (
                    <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleSelect(idx)} className="w-4 h-4 rounded border-stone-300 text-purple-700 focus:ring-purple-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-stone-900">{fac.numero || "(sin número)"}</span>
                      {fac.tipo && <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-stone-100">{fac.tipo}</Badge>}
                      <span className="text-xs text-stone-400">{fac.hoja}</span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {formatDate(fac.fecha)} | {fac.productos.length} prod. | {fac.productos.reduce((s, p) => s + p.cantidad, 0)} uds. | <span className="font-semibold">{formatMoney(fac.total)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {fac.exito ? <CheckCircle2 className="w-5 h-5 text-purple-700" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                    <button onClick={() => toggleExpand(idx)} className="p-1 hover:bg-stone-200 rounded cursor-pointer">
                      {expanded.has(idx) ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </button>
                  </div>
                </div>

                {expanded.has(idx) && (
                  <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
                    {fac.productos.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-stone-500 uppercase mb-1">Productos</p>
                        <div className="space-y-0.5">
                          {fac.productos.map((p, pi) => (
                            <p key={pi} className="text-xs text-stone-600">
                              <span className="text-stone-400">{p.cantidad}x</span>{" "}
                              {p.codigo && <span className="text-stone-400">[{p.codigo}] </span>}
                              {p.producto}{" "}
                              <span className="text-stone-400">- {formatMoney(p.subtotal)}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    {fac.errores.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 uppercase mb-1">Advertencias</p>
                        <ul className="space-y-0.5">{fac.errores.map((err, ei) => <li key={ei} className="text-xs text-amber-700">- {err}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Botón confirmar con seguridad */}
      <Card className="border-2 border-purple-200 bg-purple-50/50">
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <ShieldCheck className="w-6 h-6 text-purple-700 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-stone-900">Modo confirmación</h3>
              <p className="text-sm text-stone-600">Revisá que los datos sean correctos. Las facturas duplicadas se omiten automáticamente. Esta acción no se puede deshacer.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setPaso("subir"); setResult(null); if (fileRef.current) fileRef.current.value = ""; }} disabled={importing}>
              Cancelar
            </Button>
            <Button onClick={confirmarImport} disabled={importing || exitosasSeleccionadas === 0} className="gap-2 h-11 px-6 bg-purple-800 hover:bg-purple-900 text-white font-semibold shadow-md shadow-purple-200">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {importing ? "Guardando..." : `Confirmar e importar ${exitosasSeleccionadas} factura(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}