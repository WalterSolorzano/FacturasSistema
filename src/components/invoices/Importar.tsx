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
  Download,
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
  cliente: string;
  productos: {
    codigo: string;
    producto: string;
    cantidad: number;
    talla: string;
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
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(v);
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-AR");
}

export function Importar() {
  const { triggerRefresh, setActiveTab } = useAppStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedAll, setSelectedAll] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Subir archivo
  const procesarArchivo = useCallback(async (file: File) => {
    setLoading(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("archivo", file);

      const res = await fetch("/api/import", {
        method: "POST",
        body: fd,
      });

      const data: ImportResult = await res.json();

      if (!res.ok) throw new Error(data.error);

      setResult(data);

      // Seleccionar todas las exitosas por defecto
      const exitosasIdx = new Set<number>();
      data.facturas.forEach((f, i) => {
        if (f.exito) exitosasIdx.add(i);
      });
      setSelected(exitosasIdx);
      setSelectedAll(true);
    } catch (err) {
      toast({
        title: "Error al procesar",
        description:
          err instanceof Error
            ? err.message
            : "No se pudo leer el archivo. Verificá que sea .xlsx",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) procesarArchivo(file);
    },
    [procesarArchivo]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) procesarArchivo(file);
    },
    [procesarArchivo]
  );

  // Confirmar importación
  const confirmarImport = async () => {
    const facturasAImportar = result!.facturas.filter(
      (_, i) => selected.has(i)
    );

    if (facturasAImportar.length === 0) {
      toast({
        title: "Nada que importar",
        description: "Seleccioná al menos una factura.",
        variant: "destructive",
      });
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

      toast({
        title: "Importación completada",
        description: `${data.importadas} factura(s) importada(s)${data.duplicadas > 0 ? `, ${data.duplicadas} duplicada(s) omitida(s)` : ""}.`,
      });

      triggerRefresh();
      setResult(null);
    } catch (err) {
      toast({
        title: "Error al guardar",
        description:
          err instanceof Error ? err.message : "Intentá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAll) {
      setSelected(new Set());
      setSelectedAll(false);
    } else {
      const all = new Set<number>();
      result!.facturas.forEach((f, i) => {
        if (f.exito) all.add(i);
      });
      setSelected(all);
      setSelectedAll(true);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const exitosasSeleccionadas = result
    ? result.facturas.filter((_, i) => selected.has(i) && result.facturas[i].exito).length
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-stone-900">Importar facturas</h2>
        <p className="text-sm text-stone-500 mt-0.5">
          Subí el archivo Excel con las hojas de factura. El sistema lee todas las hojas y extrae los datos automáticamente.
        </p>
      </div>

      {/* Zona de drop */}
      {!result && (
        <Card
          className={`border-2 border-dashed transition-all cursor-pointer ${
            dragOver
              ? "border-emerald-500 bg-emerald-50"
              : "border-stone-300 hover:border-emerald-400 hover:bg-stone-50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <CardContent className="p-10 text-center">
            {loading ? (
              <div className="space-y-3">
                <Loader2 className="w-10 h-10 mx-auto text-emerald-600 animate-spin" />
                <p className="text-stone-600 font-medium">
                  Leyendo hojas del archivo...
                </p>
                <p className="text-xs text-stone-400">
                  Esto puede tardar unos segundos si hay muchas hojas
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="text-stone-900 font-semibold">
                    Arrastrá el archivo Excel aquí
                  </p>
                  <p className="text-sm text-stone-500 mt-1">
                    o hacé clic para seleccionarlo
                  </p>
                </div>
                <p className="text-xs text-stone-400">
                  Acepta archivos .xlsx con una o más hojas de factura
                </p>
              </div>
            )}
          </CardContent>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />
        </Card>
      )}

      {/* Resultado de la lectura */}
      {result && (
        <>
          {/* Resumen */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-stone-900">
                  Resultado del análisis
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="text-stone-500"
                >
                  Importar otro archivo
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-emerald-50 text-center">
                  <p className="text-2xl font-bold text-emerald-700">
                    {result.exitosas}
                  </p>
                  <p className="text-xs text-emerald-600">Extraídas bien</p>
                </div>
                <div
                  className={`p-3 rounded-lg text-center ${result.conErrores > 0 ? "bg-amber-50" : "bg-stone-50"}`}
                >
                  <p
                    className={`text-2xl font-bold ${result.conErrores > 0 ? "text-amber-700" : "text-stone-400"}`}
                  >
                    {result.conErrores}
                  </p>
                  <p className="text-xs text-amber-600">Con errores</p>
                </div>
                <div className="p-3 rounded-lg bg-stone-50 text-center">
                  <p className="text-2xl font-bold text-stone-400">
                    {result.vacias}
                  </p>
                  <p className="text-xs text-stone-500">Hojas vacías</p>
                </div>
                <div className="p-3 rounded-lg bg-stone-50 text-center">
                  <p className="text-2xl font-bold text-stone-600">
                    {result.totalHojas}
                  </p>
                  <p className="text-xs text-stone-500">Total hojas</p>
                </div>
              </div>

              {result.conErrores > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    <strong>{result.conErrores} hoja(s)</strong> no se pudieron
                    extraer completamente. Podés revisarlas abajo e importar las
                    que sí salieron bien.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de facturas encontradas */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAll}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-stone-700">
                    Seleccionar todas las válidas
                  </span>
                </label>
                <span className="text-xs text-stone-400">
                  {exitosasSeleccionadas} seleccionada(s)
                </span>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {result.facturas.map((fac, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 transition-colors ${
                      fac.exito
                        ? selected.has(idx)
                          ? "border-emerald-300 bg-emerald-50/50"
                          : "border-stone-200 bg-white hover:bg-stone-50"
                        : "border-amber-200 bg-amber-50/50 opacity-70"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      {fac.exito ? (
                        <input
                          type="checkbox"
                          checked={selected.has(idx)}
                          onChange={() => toggleSelect(idx)}
                          className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}

                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-stone-900">
                            {fac.numero || "(sin número)"}
                          </span>
                          {fac.tipo && (
                            <Badge
                              variant="secondary"
                              className="text-xs px-1.5 py-0 bg-stone-100"
                            >
                              {fac.tipo}
                            </Badge>
                          )}
                          <span className="text-xs text-stone-400">
                            {fac.hoja}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 mt-0.5">
                          {fac.cliente || "(sin cliente)"} |{" "}
                          {formatDate(fac.fecha)} |{" "}
                          {fac.productos.length} prod. |{" "}
                          {formatMoney(fac.total)}
                        </p>
                      </div>

                      {/* Estado */}
                      <div className="flex items-center gap-2">
                        {fac.exito ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        )}
                        <button
                          onClick={() => toggleExpand(idx)}
                          className="p-1 hover:bg-stone-200 rounded cursor-pointer"
                        >
                          {expanded.has(idx) ? (
                            <ChevronUp className="w-4 h-4 text-stone-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-stone-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Detalle expandido */}
                    {expanded.has(idx) && (
                      <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
                        {/* Productos */}
                        {fac.productos.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-stone-500 uppercase mb-1">
                              Productos
                            </p>
                            <div className="space-y-0.5">
                              {fac.productos.map((p, pi) => (
                                <p key={pi} className="text-xs text-stone-600">
                                  <span className="text-stone-400">
                                    {p.cantidad}x
                                  </span>{" "}
                                  {p.producto}
                                  {p.talla && (
                                    <span className="text-stone-400">
                                      {" "}
                                      (T:{p.talla})
                                    </span>
                                  )}{" "}
                                  <span className="text-stone-400">-</span>{" "}
                                  {formatMoney(p.subtotal)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Errores */}
                        {fac.errores.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-amber-600 uppercase mb-1">
                              Advertencias
                            </p>
                            <ul className="space-y-0.5">
                              {fac.errores.map((err, ei) => (
                                <li
                                  key={ei}
                                  className="text-xs text-amber-700"
                                >
                                  - {err}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              disabled={importing}
              className="gap-2"
            >
              Volver
            </Button>
            <Button
              onClick={confirmarImport}
              disabled={importing || exitosasSeleccionadas === 0}
              className="gap-2 h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-200"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              {importing
                ? "Importando..."
                : `Importar ${exitosasSeleccionadas} factura(s)`}
            </Button>
          </div>

          {/* Info */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              <strong>Nota:</strong> Las facturas duplicadas (mismo número)
              se omiten automáticamente. Si necesitás actualizar una factura
              existente, primero eliminala desde la sección "Consultar".
            </p>
          </div>
        </>
      )}
    </div>
  );
}