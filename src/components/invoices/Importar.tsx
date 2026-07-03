"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  FileWarning,
  Info,
  ExternalLink,
  AlertCircle,
  FolderOpen,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

interface ProductoPreview {
  codigo: string;
  producto: string;
  cantidad: number;
  valorUnit: number;
  subtotal: number;
  _precioCero?: boolean;
}

interface FacturaPreview {
  numero: string;
  tipo: string;
  fecha: string;
  proveedor: string;
  productos: ProductoPreview[];
  total: number;
  hoja: string;
  archivoOrigen: string;
  advertencias: string[];
  errores: string[];
  exito: boolean;
  _numeroDeHoja: boolean;
  _fechaDudosa: boolean;
  _totalCalculado?: boolean;
  _totalDiscrepancia?: string;
}

interface ImportResult {
  facturas: FacturaPreview[];
  totalHojas: number;
  exitosas: number;
  conErrores: number;
  vacias: number;
  tempFileName: string;
}

interface ExistingInvoice {
  numero: string;
  fechaEmision: string;
  total: number;
  proveedor: string;
}

// Datos crudos de una hoja Excel para el visor
interface CeldaRaw {
  coord: string;
  valor: string | number | boolean | null;
}

function formatMoney(v: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(v);
}

function formatDate(iso: string): string {
  if (!iso) return "SIN FECHA";
  return new Date(iso).toLocaleDateString("es-AR");
}

type Paso = "subir" | "revision" | "resultado";

export function Importar() {
  const { triggerRefresh, setActiveTab, activeProjectId, projects, setActiveProjectId, setIsUnsaved } = useAppStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [paso, setPaso] = useState<Paso>("subir");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedAll, setSelectedAll] = useState(false);
  const [importResult, setImportResult] = useState<{
    importadas: number;
    omitidasFecha: number;
    errores: string[];
    resumen: string[];
  } | null>(null);

  // Números que ya existen en la BD (solo informativo)
  const [numerosExistentes, setNumerosExistentes] = useState<Set<string>>(new Set());

  // Archivo subido para "Ver en Excel"
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Dialog para ver datos del Excel
  const [viewingSheet, setViewingSheet] = useState<{
    hoja: string;
    datos: CeldaRaw[][];
  } | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [editingNumberIdx, setEditingNumberIdx] = useState<number | null>(null);
  const [editingNumberValue, setEditingNumberValue] = useState("");
  const [filterType, setFilterType] = useState<"todas" | "avisos" | "errores">("todas");

  // Cuando el resultado del análisis llega, verificar cuáles ya existen
  useEffect(() => {
    if (!result || !activeProjectId) return;

    const numeros = result.facturas
      .filter((f) => f.exito && f.numero)
      .map((f) => f.numero);

    if (numeros.length === 0) return;

    // Consultar API de existentes (solo informativo)
    fetch(`/api/import/existing?projectId=${activeProjectId}&numeros=${encodeURIComponent(numeros.join(","))}`)
      .then((r) => r.json())
      .then((data: { existentes: ExistingInvoice[] }) => {
        const set = new Set<string>(data.existentes.map((e) => e.numero));
        setNumerosExistentes(set);
      })
      .catch(() => {});
  }, [result, activeProjectId]);

  useEffect(() => {
    setIsUnsaved(paso === "revision");
    // Al desmontar, si estábamos importando pero cambiamos de tab (y el usuario aceptó perder progreso), limpiar.
    return () => setIsUnsaved(false);
  }, [paso, setIsUnsaved]);

  const procesarArchivo = useCallback(async (file: File) => {
    setLoading(true);
    setResult(null);
    setNumerosExistentes(new Set());
    setPaso("subir");
    setUploadedFile(file);

    try {
      const fd = new FormData();
      fd.append("archivo", file);

      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json() as ImportResult;
      if (!res.ok) throw new Error((data as any).error);

      setResult(data);

      // Pre-seleccionar TODAS las exitosas. El usuario deselecciona las que no quiere.
      const preselected = new Set<number>();
      data.facturas.forEach((f, i) => { if (f.exito) preselected.add(i); });
      setSelected(preselected);
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

  // Abrir la hoja en el Microsoft Excel nativo del sistema operativo
  const verEnExcel = useCallback(async (sheetName: string, tempFileName: string) => {
    setLoadingSheet(true);
    try {
      const res = await fetch("/api/open-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName, tempFileName })
      });
      if (!res.ok) throw new Error("Fallo al abrir Excel");
      toast({ title: "Abriendo Excel", description: `Cargando la hoja "${sheetName}" en Microsoft Excel...` });
    } catch {
      toast({ title: "Error", description: "No se pudo abrir Excel en tu sistema operativo.", variant: "destructive" });
    } finally {
      setLoadingSheet(false);
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

  const updateInvoiceNumber = useCallback((idx: number, newNumber: string) => {
    setResult((prev) => {
      if (!prev) return prev;
      const newFacturas = [...prev.facturas];
      newFacturas[idx] = { ...newFacturas[idx], numero: newNumber };
      return { ...prev, facturas: newFacturas };
    });
  }, []);

  const confirmarImport = async () => {
    if (!result) return;
    const facturasAImportar = result.facturas.filter((_, i) => selected.has(i));
    if (facturasAImportar.length === 0) {
      toast({ title: "Nada que importar", description: "Seleccioná al menos una factura.", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const projectIdToUse = importProjectId || activeProjectId;
      if (!projectIdToUse) {
        toast({ title: "Sin proyecto", description: "Seleccioná o creá un proyecto para importar.", variant: "destructive" });
        setImporting(false);
        return;
      }

      let totalImportadas = 0;
      let totalOmitidas = 0;
      const allErrores: string[] = [];
      const allResumen: string[] = [];

      const CHUNK_SIZE = 50;
      for (let i = 0; i < facturasAImportar.length; i += CHUNK_SIZE) {
        const chunk = facturasAImportar.slice(i, i + CHUNK_SIZE);
        const res = await fetch("/api/import/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facturas: chunk, projectId: projectIdToUse }),
        });
        
        // Manejar errores de red o parseo seguro
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("El servidor no respondió correctamente. Puede que el archivo sea demasiado grande.");
        }
        
        if (!res.ok) throw new Error(data.error || "Error al procesar el lote.");

        totalImportadas += data.importadas || 0;
        totalOmitidas += data.omitidasFecha || 0;
        if (data.errores) allErrores.push(...data.errores);
        if (data.resumen) allResumen.push(...data.resumen);
      }

      setImportResult({
        importadas: totalImportadas,
        omitidasFecha: totalOmitidas,
        errores: allErrores,
        resumen: allResumen,
      });
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
      // Deseleccionar todas
      setSelected(new Set()); setSelectedAll(false);
    } else {
      // Seleccionar TODAS las exitosas
      const all = new Set<number>();
      result.facturas.forEach((f, i) => { if (f.exito) all.add(i); });
      setSelected(all); setSelectedAll(true);
    }
  };

  // Proyecto destino de la importación
  const [importProjectId, setImportProjectId] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // Al entrar a revisión, setear el proyecto activo como destino
  useEffect(() => {
    if (paso === "revision") {
      if (activeProjectId) {
        setImportProjectId(activeProjectId);
        setShowProjectPicker(false);
      } else {
        setShowProjectPicker(true);
      }
    }
  }, [paso, activeProjectId]);

  // Crear proyecto nuevo desde la pantalla de importación
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const crearProyecto = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newProjectName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportProjectId(data.id);
      setActiveProjectId(data.id);
      setNewProjectName("");
      setShowProjectPicker(false);
      toast({ title: "Proyecto creado", description: `Ahora importando en "${data.nombre}"` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo crear el proyecto.", variant: "destructive" });
    } finally {
      setCreatingProject(false);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; });
  };

  const exitosasSeleccionadas = result ? result.facturas.filter((_, i) => selected.has(i) && result.facturas[i].exito).length : 0;
  const conAdvertencias = result ? result.facturas.filter((f) => f.advertencias && f.advertencias.length > 0).length : 0;
  const sinFecha = result ? result.facturas.filter((f) => f._fechaDudosa || !f.fecha).length : 0;
  const yaExisten = result
    ? result.facturas.filter((f) => f.numero && numerosExistentes.has(f.numero)).length
    : 0;
  const conPrecioCero = result
    ? result.facturas.filter((f) => f.productos.some((p) => p._precioCero)).length
    : 0;
  const conDiscrepancia = result
    ? result.facturas.filter((f) => f._totalDiscrepancia).length
    : 0;

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

        <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 border border-sky-200">
          <FileSpreadsheet className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-sky-800"><strong>Formato esperado:</strong> Cada hoja del Excel debe ser una factura con las columnas CANTIDAD, CODIGO, DESCRIPCION, P.UNI y TOTAL. El sistema detecta automáticamente el formato.</p>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800"><strong>Vos revisás y decidís:</strong> El sistema lee los datos tal cual están. No se elimina ni se modifica nada automáticamente. Podés verificar cada factura contra el Excel original antes de confirmar. Un cliente puede comprar varias veces — eso no es duplicado.</p>
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-700" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-1">Importación completada</h3>
            <p className="text-3xl font-bold text-purple-700 my-3">{importResult.importadas} factura(s) importada(s)</p>
            <div className="flex justify-center gap-6 text-sm text-stone-500">
              {importResult.omitidasFecha > 0 && <span className="text-rose-600">{importResult.omitidasFecha} rechazada(s) por falta de fecha</span>}
            </div>
          </CardContent>
        </Card>

        {importResult.resumen && importResult.resumen.length > 0 && (
          <Card className="border border-sky-200">
            <CardContent className="p-5">
              <h4 className="font-semibold text-sky-700 mb-2">Resumen</h4>
              <ul className="space-y-1">
                {importResult.resumen.map((r, i) => <li key={i} className="text-xs text-sky-600">- {r}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        {importResult.errores.length > 0 && (
          <Card className="border border-rose-200">
            <CardContent className="p-5">
              <h4 className="font-semibold text-rose-700 mb-2">Errores detallados</h4>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {importResult.errores.map((err, i) => <li key={i} className="text-xs text-rose-600 font-mono">- {err}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setPaso("subir"); setResult(null); setImportResult(null); setNumerosExistentes(new Set()); setUploadedFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
            Importar otro archivo
          </Button>
          <Button onClick={() => setActiveTab("consultar")} className="bg-purple-800 hover:bg-purple-900 text-white font-semibold shadow-md shadow-purple-200">
            Ver facturas importadas
          </Button>
        </div>
      </div>
    );
  }

  // PASO: REVISIÓN
  if (!result) return null;

  return (
    <>
      <div className="space-y-5 animate-in fade-in max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Revisión de datos</h2>
            <p className="text-sm text-stone-500 mt-0.5">Revisá cada factura. Seleccioná las que querés importar.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setPaso("subir"); setResult(null); setNumerosExistentes(new Set()); setUploadedFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
            Volver
          </Button>
        </div>

        {/* Barra de progreso */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-purple-700" /><span className="font-medium text-purple-800">Paso 1: Cargar archivo</span></div>
          <div className="w-8 h-px bg-purple-300" />
          <div className="flex items-center gap-1.5"><Eye className="w-4 h-4 text-purple-700" /><span className="font-medium text-purple-800">Paso 2: Revisión</span></div>
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
                <p className="text-xs text-purple-700">Extraídas</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${result.conErrores > 0 ? "bg-rose-50" : "bg-stone-50"}`}>
                <p className={`text-2xl font-bold ${result.conErrores > 0 ? "text-rose-600" : "text-stone-400"}`}>{result.conErrores}</p>
                <p className="text-xs text-rose-500">Con errores</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${conAdvertencias + conPrecioCero + conDiscrepancia > 0 ? "bg-sky-50" : "bg-stone-50"}`}>
                <p className={`text-2xl font-bold ${conAdvertencias + conPrecioCero + conDiscrepancia > 0 ? "text-sky-600" : "text-stone-400"}`}>{conAdvertencias + conPrecioCero + conDiscrepancia}</p>
                <p className="text-xs text-sky-600">Con avisos</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${yaExisten > 0 ? "bg-slate-50" : "bg-stone-50"}`}>
                <p className={`text-2xl font-bold ${yaExisten > 0 ? "text-slate-600" : "text-stone-400"}`}>{yaExisten}</p>
                <p className="text-xs text-slate-500">Ya en BD</p>
              </div>
            </div>

            {/* Nota informativa */}
            <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700">
                <strong>Vos decidís qué importar.</strong> Marcá las facturas que querés guardar.
                Si un número ya existe, se te informa pero podés importarlo igual — un cliente puede comprar varias veces.
                Usá el botón <strong>"Ver en Excel"</strong> para comprobar cualquier dato contra el original.
              </p>
            </div>

            {yaExisten > 0 && (
              <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">
                  <strong>{yaExisten} factura(s)</strong> ya están en la base de datos. Si son compras reales nuevas, es normal que aparezcan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de facturas */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedAll} onChange={toggleAll} className="w-4 h-4 rounded border-stone-300 text-purple-700 focus:ring-purple-500" />
                  <span className="text-sm font-medium text-stone-700">{selectedAll ? "Deseleccionar todas" : "Seleccionar todas"}</span>
                </label>
                <span className="text-xs text-stone-400">{exitosasSeleccionadas} de {result.facturas.filter(f => f.exito).length} seleccionada(s)</span>
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="text-sm border border-stone-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
              >
                <option value="todas">Mostrar todas</option>
                <option value="avisos">Solo con avisos</option>
                <option value="errores">Solo con errores</option>
              </select>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {result.facturas.map((fac, idx) => {
                const tieneAdvertencias = fac.advertencias && fac.advertencias.length > 0;
                const tieneFecha = fac.fecha && !fac._fechaDudosa;
                const existeEnBD = fac.numero && numerosExistentes.has(fac.numero);
                const tienePrecioCero = fac.productos.some((p) => p._precioCero);
                const tieneDiscrepancia = !!fac._totalDiscrepancia;
                const tieneTotalCalculado = !!fac._totalCalculado;
                const totalEsNegativo = fac.total < 0;

                const tieneCualquierAviso = tieneAdvertencias || !tieneFecha || existeEnBD || tienePrecioCero || tieneDiscrepancia || tieneTotalCalculado || fac._numeroDeHoja || totalEsNegativo;

                if (filterType === "avisos" && !tieneCualquierAviso) return null;
                if (filterType === "errores" && fac.exito) return null;

                return (
                  <div key={idx} className={`rounded-lg border p-3 transition-colors ${
                    !fac.exito ? "border-rose-200 bg-rose-50/50 opacity-70" :
                    fac._fechaDudosa ? "border-rose-200 bg-rose-50/30" :
                    existeEnBD ? "border-slate-200 bg-slate-50/30" :
                    selected.has(idx) ? "border-purple-300 bg-purple-50/50" :
                    "border-stone-200 bg-white hover:bg-stone-50"
                  }`}>
                    <div className="flex items-center gap-3">
                      {fac.exito ? (
                        <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleSelect(idx)} className="w-4 h-4 rounded border-stone-300 text-purple-700 focus:ring-purple-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {editingNumberIdx === idx ? (
                            <div className="flex items-center gap-1">
                              <input 
                                autoFocus
                                value={editingNumberValue}
                                onChange={(e) => setEditingNumberValue(e.target.value)}
                                className="h-6 text-sm border border-stone-300 rounded px-1.5 focus:ring-1 focus:ring-purple-500 w-32"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    updateInvoiceNumber(idx, editingNumberValue);
                                    setEditingNumberIdx(null);
                                  } else if (e.key === "Escape") {
                                    setEditingNumberIdx(null);
                                  }
                                }}
                              />
                              <button onClick={() => { updateInvoiceNumber(idx, editingNumberValue); setEditingNumberIdx(null); }} className="text-purple-600 hover:text-purple-800"><CheckCircle2 className="w-4 h-4" /></button>
                              <button onClick={() => setEditingNumberIdx(null)} className="text-stone-400 hover:text-stone-600"><XCircle className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group/edit">
                              <span className="font-medium text-sm text-stone-900">{fac.numero || "(sin número)"}</span>
                              <button 
                                onClick={() => { setEditingNumberIdx(idx); setEditingNumberValue(fac.numero || ""); }}
                                className="opacity-0 group-hover/edit:opacity-100 p-0.5 text-stone-400 hover:text-purple-600 transition-all cursor-pointer"
                                title="Editar número"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                              </button>
                            </div>
                          )}
                          {fac.tipo && <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-stone-100">{fac.tipo}</Badge>}
                          {/* Indicadores — informativos, no bloqueantes */}
                          {existeEnBD && <Badge className="text-xs px-1.5 py-0 bg-slate-100 text-slate-700 border-slate-200">Ya existe</Badge>}
                          {fac._numeroDeHoja && <Badge className="text-xs px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200">N° dudoso</Badge>}
                          {!tieneFecha && fac.exito && <Badge className="text-xs px-1.5 py-0 bg-rose-100 text-rose-700 border-rose-200">Sin fecha</Badge>}
                          {tienePrecioCero && <Badge className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">$0</Badge>}
                          {totalEsNegativo && <Badge className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">Total Negativo</Badge>}
                          {tieneDiscrepancia && <Badge className="text-xs px-1.5 py-0 bg-sky-100 text-sky-700 border-sky-200">Discrepancia</Badge>}
                          {tieneTotalCalculado && !tieneDiscrepancia && <Badge className="text-xs px-1.5 py-0 bg-sky-100 text-sky-700 border-sky-200">Total calculado</Badge>}
                          {tieneAdvertencias && <Badge className="text-xs px-1.5 py-0 bg-sky-100 text-sky-700 border-sky-200">{fac.advertencias!.length} aviso(s)</Badge>}
                          {!fac.exito && fac.errores && fac.errores.length > 0 && <Badge className="text-xs px-1.5 py-0 bg-rose-100 text-rose-700 border-rose-200">{fac.errores[0]}</Badge>}
                          <span className="text-xs text-stone-400">{fac.hoja}</span>
                        </div>
                        <p className="text-xs text-stone-600 mt-0.5">
                          {formatDate(fac.fecha)} | {fac.proveedor || "(sin cliente)"} | {fac.productos.length} prod. | {fac.productos.reduce((s, p) => s + p.cantidad, 0)} uds. | <span className="font-semibold">{formatMoney(fac.total)}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Botón Ver en Excel */}
                        <button
                          onClick={() => verEnExcel(fac.hoja, result.tempFileName)}
                          disabled={loadingSheet}
                          className="p-1.5 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer group"
                          title="Ver datos originales en el Excel"
                        >
                          <ExternalLink className={`w-4 h-4 text-sky-500 group-hover:text-sky-700 ${loadingSheet ? "animate-pulse" : ""}`} />
                        </button>

                        {fac.exito ? <CheckCircle2 className="w-5 h-5 text-purple-700" /> : <AlertTriangle className="w-5 h-5 text-rose-500" />}
                        <button onClick={() => toggleExpand(idx)} className="p-1 hover:bg-stone-200 rounded cursor-pointer">
                          {expanded.has(idx) ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                        </button>
                      </div>
                    </div>

                    {expanded.has(idx) && (
                      <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
                        {/* Origen del dato */}
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Archivo: <strong>{fac.archivoOrigen || "desconocido"}</strong> | Hoja: <strong>{fac.hoja}</strong></span>
                          <button
                            onClick={() => verEnExcel(fac.hoja, result.tempFileName)}
                            className="ml-2 text-sky-600 hover:text-sky-800 underline cursor-pointer text-xs"
                          >
                            Ver en Excel
                          </button>
                        </div>

                        {/* Aviso de "ya existe" */}
                        {existeEnBD && (
                          <div className="p-2 rounded bg-slate-50 border border-slate-100">
                            <p className="text-xs text-slate-600 flex items-center gap-1">
                              <Info className="w-3.5 h-3.5" />
                              Este número ya está en la base de datos. Si es una compra nueva del mismo cliente, es normal. Vos decidís.
                            </p>
                          </div>
                        )}

                        {/* Discrepancia de total */}
                        {tieneDiscrepancia && (
                          <div className="p-2 rounded bg-sky-50 border border-sky-200">
                            <p className="text-xs font-semibold text-sky-600 uppercase mb-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Discrepancia de total
                            </p>
                            <p className="text-xs text-sky-700">{fac._totalDiscrepancia}</p>
                          </div>
                        )}

                        {/* Advertencias */}
                        {tieneAdvertencias && (
                          <div className="p-2 rounded bg-sky-50 border border-sky-100">
                            <p className="text-xs font-semibold text-sky-600 uppercase mb-1 flex items-center gap-1">
                              <FileWarning className="w-3.5 h-3.5" /> Advertencias
                            </p>
                            <ul className="space-y-0.5">
                              {fac.advertencias!.map((w, wi) => <li key={wi} className="text-xs text-sky-700">- {w}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* Productos */}
                        {fac.productos.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-stone-500 uppercase mb-1">Productos</p>
                            <div className="space-y-0.5">
                              {fac.productos.map((p, pi) => (
                                <p key={pi} className={`text-xs ${p._precioCero ? "text-orange-600 font-medium" : "text-stone-600"}`}>
                                  <span className="text-stone-400">{p.cantidad}x</span>{" "}
                                  {p.codigo && <span className="text-stone-400">[{p.codigo}] </span>}
                                  {p.producto}{" "}
                                  {p._precioCero && <span className="text-orange-500">⚠ Precio $0</span>}
                                  <span className="text-stone-400"> - {formatMoney(p.subtotal)}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Errores */}
                        {fac.errores.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-rose-600 uppercase mb-1">Errores</p>
                            <ul className="space-y-0.5">{fac.errores.map((err, ei) => <li key={ei} className="text-xs text-rose-700">- {err}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selector de proyecto + Botón confirmar */}
        <Card className="border-2 border-purple-200 bg-purple-50/50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <ShieldCheck className="w-6 h-6 text-purple-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-stone-900">Confirmar importación</h3>
                <p className="text-sm text-stone-600">
                  Se van a guardar las <strong>{exitosasSeleccionadas} factura(s)</strong> que seleccionaste, exactamente como están.
                  {yaExisten > 0 && ` De esas, ${yaExisten} ya existen en la base de datos.`}
                </p>
              </div>
            </div>

            {/* Selector de proyecto destino */}
            <div className="mb-4 p-3 rounded-lg bg-white border border-stone-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-purple-700" />
                  <span className="text-sm font-medium text-stone-700">Importar en el proyecto:</span>
                </div>
                <button
                  onClick={() => setShowProjectPicker(!showProjectPicker)}
                  className="text-xs text-purple-700 hover:text-purple-800 font-medium cursor-pointer underline"
                >
                  Cambiar proyecto
                </button>
              </div>
              <p className="text-sm font-semibold text-purple-800">
                {(Array.isArray(projects) ? projects : []).find(p => p.id === importProjectId)?.nombre || (importProjectId ? "Proyecto seleccionado" : "Ningún proyecto")}
              </p>
              {importProjectId && (() => {
                const safeProjects = Array.isArray(projects) ? projects : [];
                const proj = safeProjects.find(p => p.id === importProjectId);
                return proj ? (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {proj._count?.invoices || 0} factura(s) ya cargada(s) en este proyecto — las nuevas se sumarán
                  </p>
                ) : null;
              })()}
            </div>

            {/* Panel para cambiar/crear proyecto */}
            {showProjectPicker && (
              <div className="mb-4 p-3 rounded-lg bg-stone-50 border border-stone-200 space-y-3">
                <p className="text-xs font-semibold text-stone-500 uppercase">Seleccionar otro proyecto</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {(Array.isArray(projects) ? projects : []).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setImportProjectId(p.id); setShowProjectPicker(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                        p.id === importProjectId
                          ? "bg-purple-100 border border-purple-300 text-purple-800 font-medium"
                          : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      <span>{p.nombre}</span>
                      <span className="text-xs text-stone-400 ml-2">({p._count.invoices} fact.)</span>
                    </button>
                  ))}
                  {(!Array.isArray(projects) || projects.length === 0) && <p className="text-xs text-stone-400 py-2">No hay proyectos creados.</p>}
                </div>

                <div className="border-t border-stone-200 pt-3">
                  <p className="text-xs font-semibold text-stone-500 uppercase mb-1.5">O crear uno nuevo</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Nombre del nuevo proyecto"
                      className="flex-1 h-9 px-3 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      onKeyDown={(e) => e.key === "Enter" && crearProyecto()}
                    />
                    <Button
                      size="sm"
                      onClick={crearProyecto}
                      disabled={creatingProject || !newProjectName.trim()}
                      className="gap-1.5 bg-purple-800 hover:bg-purple-900 text-white"
                    >
                      {creatingProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Crear
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setPaso("subir"); setResult(null); setNumerosExistentes(new Set()); setUploadedFile(null); if (fileRef.current) fileRef.current.value = ""; }} disabled={importing}>
                Cancelar
              </Button>
              <Button onClick={confirmarImport} disabled={importing || exitosasSeleccionadas === 0 || !importProjectId} className="gap-2 h-11 px-6 bg-purple-800 hover:bg-purple-900 text-white font-semibold shadow-md shadow-purple-200">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {importing ? "Guardando..." : `Confirmar ${exitosasSeleccionadas} factura(s)`}
              </Button>
            </div>
            {!importProjectId && (
              <p className="text-xs text-rose-500 mt-2">Seleccioná un proyecto antes de confirmar.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Ver datos del Excel (eliminado, ahora abre nativo) */}
    </>
  );
}