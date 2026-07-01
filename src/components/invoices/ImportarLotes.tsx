"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, UploadCloud, FolderOpen, Files, CheckCircle2, AlertTriangle, 
  ShieldCheck, ChevronDown, ChevronUp, CheckSquare, Square, 
  FileSpreadsheet, ExternalLink, XCircle, AlertCircle, FileWarning, Eye, ChevronRight
} from "lucide-react";

type ModoImportacion = "un_proyecto" | "por_cliente" | "por_archivo" | "por_carpeta";

function formatMoney(v: number): string {
  if (v == null || isNaN(v)) return "$0,00";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(v);
}

function formatDate(iso: string): string {
  if (!iso) return "SIN FECHA";
  return new Date(iso).toLocaleDateString("es-AR");
}

export function ImportarLotes() {
  const { triggerRefresh, setActiveTab, activeProjectId, projects, setActiveProjectId, setIsUnsaved } = useAppStore();
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [paso, setPaso] = useState<"seleccionar" | "revisar_datos" | "configurar" | "resultado">("seleccionar");
  
  const [archivosResult, setArchivosResult] = useState<any[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());
  const [expandedFacturas, setExpandedFacturas] = useState<Set<string>>(new Set());
  
  const [modo, setModo] = useState<ModoImportacion>("un_proyecto");
  const [destinoId, setDestinoId] = useState<string>(activeProjectId || "");
  const [nuevoNombre, setNuevoNombre] = useState<string>("");

  const [importing, setImporting] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState<{importadas: number, errores: string[]}|null>(null);

  const [loadingSheet, setLoadingSheet] = useState(false);

  // Nuevos estados para Corrección y Ordenamiento
  const [sortModo, setSortModo] = useState<"original" | "avisos">("original");
  const [modoCorreccion, setModoCorreccion] = useState(false);
  const [filtroCorreccion, setFiltroCorreccion] = useState<"todos" | "negativos" | "ceros">("todos");

  useEffect(() => {
    setIsUnsaved(paso === "revisar_datos" || paso === "configurar");
    return () => setIsUnsaved(false);
  }, [paso, setIsUnsaved]);

  const procesarArchivos = async (archivos: File[]) => {
    const xlsxFiles = archivos.filter(f => f.name.match(/\.xlsx?$/i));
    if (xlsxFiles.length === 0) {
      toast({ title: "No hay Excel", description: "No se encontraron archivos .xlsx", variant: "destructive" });
      return;
    }

    setLoading(true);
    const results: any[] = [];
    
    const CHUNK = 10;
    for (let i = 0; i < xlsxFiles.length; i += CHUNK) {
      const chunk = xlsxFiles.slice(i, i + CHUNK);
      const fd = new FormData();
      chunk.forEach(f => {
        fd.append("archivos", f);
        const path = (f as any).webkitRelativePath || f.name;
        const carpeta = path.includes("/") ? path.split("/")[0] : "Raíz";
        fd.append(`carpeta_${f.name}`, carpeta);
      });

      try {
        const res = await fetch("/api/import/batch", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.archivos) {
          const filesWithIds = data.archivos.map((ar: any, fIdx: number) => {
            const sortedFacturas = (ar.facturas || [])
              .filter((f: any) => f.exito)
              .map((f: any, iIdx: number) => ({
                ...f,
                _id: `file-${results.length + fIdx}-item-${iIdx}`,
                _selected: true
              }));
            return { ...ar, facturas: sortedFacturas };
          });
          results.push(...filesWithIds);
        }
      } catch (err) {
        console.error(err);
      }
    }

    setArchivosResult(results);
    setExpandedFiles(new Set([0]));
    setPaso("revisar_datos");
    setLoading(false);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) procesarArchivos(Array.from(e.target.files));
  };

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

  const toggleFileExpansion = (index: number) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const toggleFacturaExpansion = (id: string) => {
    setExpandedFacturas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleFacturaSelection = (fileIndex: number, facturaId: string) => {
    const newArchivos = [...archivosResult];
    const fac = newArchivos[fileIndex].facturas.find((f: any) => f._id === facturaId);
    if (fac) fac._selected = !fac._selected;
    setArchivosResult(newArchivos);
  };

  const toggleAllInFile = (fileIndex: number) => {
    const newArchivos = [...archivosResult];
    const file = newArchivos[fileIndex];
    const allSelected = file.facturas.every((f: any) => f._selected);
    file.facturas.forEach((f: any) => { f._selected = !allSelected; });
    setArchivosResult(newArchivos);
  };

  const convertirNegativosAPositivos = () => {
    const newArchivos = [...archivosResult];
    let cambiadas = 0;
    newArchivos.forEach(ar => {
      ar.facturas.forEach((f: any) => {
        if (f.total < 0) {
          f.total = Math.abs(f.total);
          if (f.productos) {
            f.productos.forEach((p: any) => {
              p.valorUnit = Math.abs(p.valorUnit);
              p.subtotal = Math.abs(p.subtotal);
            });
          }
          if (!f.advertencias) f.advertencias = [];
          if (!f.advertencias.includes("ACTUALIZADA")) f.advertencias.unshift("ACTUALIZADA");
          cambiadas++;
        }
      });
    });
    setArchivosResult(newArchivos);
    toast({ title: "Corrección Aplicada", description: `Se convirtieron ${cambiadas} facturas negativas a positivas.` });
  };

  const selectedCount = archivosResult.reduce((sum, ar) => sum + ar.facturas.filter((f: any) => f._selected).length, 0);

  const confirmarLotes = async () => {
    setImporting(true);
    let errorLog: string[] = [];
    let totalExitosas = 0;

    try {
      const todasLasFacturas = archivosResult.flatMap(ar => 
        (ar.facturas || []).filter((f: any) => f._selected).map((f: any) => ({
          ...f,
          _carpetaOrigen: ar.carpeta,
          _archivoOrigen: ar.nombreArchivo
        }))
      );

      if (todasLasFacturas.length === 0) {
        toast({ title: "Nada que importar", variant: "destructive" });
        setImporting(false);
        return;
      }

      const grupos = new Map<string, any[]>();

      if (modo === "un_proyecto") {
        let pId = destinoId;
        if (!pId && nuevoNombre.trim()) {
          const res = await fetch("/api/projects", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nuevoNombre.trim() })
          });
          const data = await res.json();
          if (res.ok) {
            pId = data.id;
            setActiveProjectId(pId);
          }
        }
        if (!pId) throw new Error("Debes seleccionar o crear un proyecto");
        grupos.set(pId, todasLasFacturas);
      } 
      else if (modo === "por_cliente") {
        todasLasFacturas.forEach(f => {
          const cliente = (f.proveedor || "Sin Nombre").trim().toUpperCase();
          if (!grupos.has(cliente)) grupos.set(cliente, []);
          grupos.get(cliente)!.push(f);
        });
      }
      else if (modo === "por_archivo") {
        todasLasFacturas.forEach(f => {
          const archivo = f._archivoOrigen || "Desconocido";
          if (!grupos.has(archivo)) grupos.set(archivo, []);
          grupos.get(archivo)!.push(f);
        });
      }
      else if (modo === "por_carpeta") {
        todasLasFacturas.forEach(f => {
          const carpeta = f._carpetaOrigen || "Raíz";
          if (!grupos.has(carpeta)) grupos.set(carpeta, []);
          grupos.get(carpeta)!.push(f);
        });
      }

      for (const [clave, facturas] of Array.from(grupos.entries())) {
        let targetProjectId = clave;

        if (modo !== "un_proyecto") {
          const existe = projects.find(p => p.nombre.toUpperCase() === clave.toUpperCase());
          if (existe) {
            targetProjectId = existe.id;
          } else {
            const res = await fetch("/api/projects", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nombre: clave })
            });
            if (res.ok) {
              const data = await res.json();
              targetProjectId = data.id;
            } else {
              errorLog.push(`No se pudo crear el proyecto para: ${clave}`);
              continue;
            }
          }
        }

        const CHUNK = 50;
        for (let i = 0; i < facturas.length; i += CHUNK) {
          const chunk = facturas.slice(i, i + CHUNK);
          const res = await fetch("/api/import/confirm", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facturas: chunk, projectId: targetProjectId })
          });
          const data = await res.json();
          if (res.ok) {
            totalExitosas += (data.importadas || 0);
          } else {
            errorLog.push(`Error en lote: ${data.error}`);
          }
        }
      }

      setResultadoFinal({ importadas: totalExitosas, errores: errorLog });
      setPaso("resultado");
      triggerRefresh();

    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error al procesar", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const renderPasos = () => (
    <div className="flex items-center gap-2 text-xs mb-6 w-full max-w-4xl mx-auto flex-wrap">
      <div className={`flex items-center gap-1.5 ${paso === "seleccionar" ? "font-bold text-purple-800" : "font-medium text-purple-600"}`}>
        <UploadCloud className="w-4 h-4" /><span>Paso 1: Archivos</span>
      </div>
      <div className={`w-8 h-px ${paso === "seleccionar" ? "bg-stone-300" : "bg-purple-300"}`} />
      <div className={`flex items-center gap-1.5 ${paso === "revisar_datos" ? "font-bold text-purple-800" : paso === "configurar" ? "font-medium text-purple-600" : "text-stone-400"}`}>
        <Eye className="w-4 h-4" /><span>Paso 2: Revisión</span>
      </div>
      <div className={`w-8 h-px ${paso === "configurar" ? "bg-purple-300" : "bg-stone-300"}`} />
      <div className={`flex items-center gap-1.5 ${paso === "configurar" ? "font-bold text-purple-800" : "text-stone-400"}`}>
        <CheckCircle2 className="w-4 h-4" /><span>Paso 3: Destino</span>
      </div>
    </div>
  );

  if (paso === "seleccionar") {
    return (
      <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto px-2">
        {renderPasos()}
        <div>
          <h2 className="text-xl font-bold text-stone-900">Importación Masiva (Lotes)</h2>
          <p className="text-sm text-stone-500">Seleccioná múltiples archivos o una carpeta entera.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="hover:border-purple-400 cursor-pointer transition-colors group" onClick={() => fileInputRef.current?.click()}>
            <CardContent className="p-10 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                <Files className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg text-stone-800">Múltiples Archivos</h3>
              <p className="text-sm text-stone-500">Elegí varios Excel (.xlsx) a la vez</p>
            </CardContent>
          </Card>
          
          <Card className="hover:border-purple-400 cursor-pointer transition-colors group" onClick={() => folderInputRef.current?.click()}>
            <CardContent className="p-10 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                <FolderOpen className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg text-stone-800">Desde Carpeta</h3>
              <p className="text-sm text-stone-500">Sube todos los Excel dentro de una carpeta raíz</p>
            </CardContent>
          </Card>
        </div>

        <input type="file" multiple accept=".xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFiles} />
        <input type="file" className="hidden" ref={folderInputRef} onChange={handleFiles} {...{ webkitdirectory: "", directory: "" } as any} />

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-stone-200 mt-6">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
            <p className="text-stone-800 font-medium">Leyendo y Extrayendo Datos...</p>
            <p className="text-xs text-stone-400 mt-1">Dependiendo de la cantidad de archivos, esto tomará unos segundos.</p>
          </div>
        )}
      </div>
    );
  }

  if (paso === "revisar_datos") {
    return (
      <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto px-2">
        {renderPasos()}
        
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-stone-200 shadow-sm sticky top-14 z-40 flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Revisión de Facturas</h2>
            <p className="text-sm text-stone-500">Revisa los avisos y selecciona qué facturas importar.</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" onClick={() => setPaso("seleccionar")}>Volver</Button>
            
            <Button 
              variant="outline" 
              className="border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100"
              onClick={() => setModoCorreccion(true)}
            >
              <AlertTriangle className="w-4 h-4 mr-2" /> Corregir Errores Comunes
            </Button>

            <div className="text-right border-l border-stone-200 pl-4 hidden sm:block">
              <p className="text-xs text-stone-400 font-medium">SELECCIONADAS</p>
              <p className="text-xl font-bold text-purple-700">{selectedCount}</p>
            </div>
            <Button onClick={() => setPaso("configurar")} disabled={selectedCount === 0} className="bg-purple-800 hover:bg-purple-900 text-white shadow-md">
              Siguiente <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {modoCorreccion ? (
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-orange-500" /> Modo Corrección
                </h3>
                <p className="text-sm text-stone-500">Corrige problemas comunes masivamente antes de importar.</p>
              </div>
              <Button variant="ghost" onClick={() => setModoCorreccion(false)}>
                Cerrar Corrección
              </Button>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg mb-6 flex items-start gap-3">
              <FileWarning className="w-6 h-6 text-rose-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-rose-900">NOTA IMPORTANTE</p>
                <p className="text-xs text-rose-700 mt-1">
                  Los cambios que realices aquí <strong>solo afectarán la base de datos</strong> de este sistema. Tu archivo Excel original permanecerá intacto y no será modificado. Si prefieres modificar tu Excel, elimina (deselecciona) las facturas con error aquí, corrígelas en Excel y vuelve a subirlas más tarde (el sistema evitará duplicados inteligentemente).
                </p>
              </div>
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
              <Button variant={filtroCorreccion === "todos" ? "default" : "outline"} onClick={() => setFiltroCorreccion("todos")}>Todas con Avisos</Button>
              <Button variant={filtroCorreccion === "negativos" ? "default" : "outline"} onClick={() => setFiltroCorreccion("negativos")}>Totales Negativos</Button>
              <Button variant={filtroCorreccion === "ceros" ? "default" : "outline"} onClick={() => setFiltroCorreccion("ceros")}>Precios en $0</Button>
            </div>

            {filtroCorreccion === "negativos" && (
              <div className="mb-6 p-4 border border-orange-200 bg-orange-50 rounded-lg flex items-center justify-between flex-wrap gap-4">
                <p className="text-sm text-orange-800">Tienes facturas con total negativo. ¿Deseas pasarlas todas a positivo?</p>
                <Button onClick={convertirNegativosAPositivos} className="bg-orange-600 hover:bg-orange-700 text-white">
                  Convertir todos los negativos a positivos
                </Button>
              </div>
            )}

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {archivosResult.map((ar, fIdx) => (
                ar.facturas.map((fac: any) => {
                  if (!fac._selected) return null; // Ocultar si ya la "eliminó"
                  const isNegative = fac.total < 0;
                  const hasZero = fac.productos?.some((p:any) => p._precioCero);
                  const hasWarns = fac.advertencias?.length > 0 || isNegative || hasZero || fac._totalDiscrepancia;
                  
                  if (!hasWarns) return null; // Solo mostrar con problemas
                  if (filtroCorreccion === "negativos" && !isNegative) return null;
                  if (filtroCorreccion === "ceros" && !hasZero) return null;

                  return (
                    <div key={fac._id} className="border border-stone-200 bg-white rounded-lg p-3 flex justify-between items-center gap-4 flex-wrap shadow-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-stone-800">{fac.numero || "S/N"}</span>
                          <span className="text-xs text-stone-500">({ar.nombreArchivo})</span>
                          {isNegative && <Badge className="bg-rose-100 text-rose-700">Negativo</Badge>}
                          {hasZero && <Badge className="bg-orange-100 text-orange-700">Precio $0</Badge>}
                        </div>
                        <p className="text-xs text-stone-600">{fac.proveedor} • {formatMoney(fac.total)}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => toggleFacturaSelection(fIdx, fac._id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Descartar
                        </Button>
                      </div>
                    </div>
                  );
                })
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 mt-2">
              <span className="text-sm font-medium text-stone-600">Ordenar lista por:</span>
              <select
                value={sortModo}
                onChange={(e) => setSortModo(e.target.value as any)}
                className="text-sm border-stone-300 rounded-md p-1.5 border focus:ring-purple-500 bg-white"
              >
                <option value="original">Orden Original (Por archivo)</option>
                <option value="avisos">Facturas con Avisos Primero</option>
              </select>
            </div>

            <div className="space-y-5">
              {archivosResult.map((ar, fIdx) => {
                const isExpandedFile = expandedFiles.has(fIdx);
                const allSelected = ar.facturas.every((f: any) => f._selected);
                const someSelected = ar.facturas.some((f: any) => f._selected);
                const hasWarnings = ar.facturas.some((f: any) => f.advertencias);

                let facturasAMostrar = [...ar.facturas];
                if (sortModo === "avisos") {
                  facturasAMostrar.sort((a, b) => {
                    const hasWarn = (f: any) => (f.advertencias?.length > 0 || f._totalDiscrepancia || (f.productos && f.productos.some((p:any)=>p._precioCero)) || f.total < 0) ? 1 : 0;
                    return hasWarn(b) - hasWarn(a);
                  });
                }

                return (
                  <Card key={fIdx} className="overflow-hidden border-stone-200 shadow-sm">
                <div 
                  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 transition-colors flex-wrap gap-4 ${isExpandedFile ? 'bg-stone-50 border-b border-stone-200' : ''}`}
                  onClick={() => toggleFileExpansion(fIdx)}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleAllInFile(fIdx); }}
                      className="text-stone-400 hover:text-purple-600 focus:outline-none"
                    >
                      {allSelected ? <CheckSquare className="w-5 h-5 text-purple-600" /> : someSelected ? <CheckSquare className="w-5 h-5 text-purple-400 opacity-50" /> : <Square className="w-5 h-5" />}
                    </button>
                    <div className="p-2 bg-purple-100 rounded-lg hidden sm:block">
                      <FileSpreadsheet className="w-5 h-5 text-purple-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-800 break-all">{ar.nombreArchivo}</h3>
                      <p className="text-xs text-stone-500">Carpeta: {ar.carpeta} • {ar.facturas.length} facturas válidas encontradas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {hasWarnings && (
                      <Badge className="bg-sky-100 text-sky-700 border-sky-200 font-medium">Avisos Detectados</Badge>
                    )}
                    {isExpandedFile ? <ChevronDown className="w-5 h-5 text-stone-400" /> : <ChevronRight className="w-5 h-5 text-stone-400" />}
                  </div>
                </div>

                {isExpandedFile && (
                  <div className="p-3 bg-stone-50/50 space-y-2 max-h-[500px] overflow-y-auto">
                    {facturasAMostrar.map((fac: any) => {
                      const isExpanded = expandedFacturas.has(fac._id);
                      const tieneAdvertencias = fac.advertencias && fac.advertencias.length > 0;
                      const tieneFecha = fac.fecha && !fac._fechaDudosa;
                      const tienePrecioCero = fac.productos && fac.productos.some((p: any) => p._precioCero);
                      const tieneDiscrepancia = !!fac._totalDiscrepancia;
                      const tieneTotalCalculado = !!fac._totalCalculado;
                      const totalEsNegativo = fac.total < 0;

                      return (
                        <div key={fac._id} className={`rounded-lg border p-3 transition-colors ${
                          fac._fechaDudosa ? "border-rose-200 bg-rose-50/30" :
                          fac._selected ? "border-purple-300 bg-white shadow-sm" :
                          "border-stone-200 bg-stone-100/50 opacity-70 hover:bg-stone-50"
                        }`}>
                          <div className="flex items-center gap-3 flex-wrap">
                            <input 
                              type="checkbox" 
                              checked={fac._selected} 
                              onChange={() => toggleFacturaSelection(fIdx, fac._id)} 
                              className="w-4 h-4 rounded border-stone-300 text-purple-700 focus:ring-purple-500" 
                            />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-stone-900">{fac.numero || "(sin número)"}</span>
                                {fac.tipo && <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-stone-100">{fac.tipo}</Badge>}
                                
                                {fac._numeroDeHoja && <Badge className="text-xs px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200">N° dudoso</Badge>}
                                {!tieneFecha && fac.exito && <Badge className="text-xs px-1.5 py-0 bg-rose-100 text-rose-700 border-rose-200">Sin fecha</Badge>}
                                {tienePrecioCero && <Badge className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">$0</Badge>}
                                {totalEsNegativo && <Badge className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">Total Negativo</Badge>}
                                {tieneDiscrepancia && <Badge className="text-xs px-1.5 py-0 bg-sky-100 text-sky-700 border-sky-200">Discrepancia</Badge>}
                                {tieneTotalCalculado && !tieneDiscrepancia && <Badge className="text-xs px-1.5 py-0 bg-sky-100 text-sky-700 border-sky-200">Total calculado</Badge>}
                                {tieneAdvertencias && <Badge className="text-xs px-1.5 py-0 bg-sky-100 text-sky-700 border-sky-200">{fac.advertencias!.length} aviso(s)</Badge>}
                                {!fac.exito && fac.errores && fac.errores.length > 0 && <Badge className="text-xs px-1.5 py-0 bg-rose-100 text-rose-700 border-rose-200">{fac.errores[0]}</Badge>}
                                
                                <span className="text-xs text-stone-400 truncate max-w-[100px]">{fac.hoja}</span>
                              </div>
                              <p className="text-xs text-stone-600 mt-1 flex flex-wrap items-center gap-1">
                                <span>{formatDate(fac.fecha)}</span>
                                <span className="text-stone-300">|</span>
                                <span className="truncate max-w-[150px] sm:max-w-xs">{fac.proveedor || "(sin cliente)"}</span>
                                <span className="text-stone-300">|</span>
                                <span>{fac.productos ? fac.productos.length : 0} prod.</span>
                                <span className="text-stone-300">|</span>
                                <span className="font-semibold">{formatMoney(fac.total)}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => verEnExcel(fac.hoja, ar.tempFileName)}
                                disabled={loadingSheet}
                                className="p-1.5 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer group"
                                title="Ver datos originales en Excel"
                              >
                                <ExternalLink className={`w-4 h-4 text-sky-500 group-hover:text-sky-700 ${loadingSheet ? "animate-pulse" : ""}`} />
                              </button>

                              {fac.exito ? <CheckCircle2 className="w-5 h-5 text-purple-700" /> : <AlertTriangle className="w-5 h-5 text-rose-500" />}
                              <button onClick={() => toggleFacturaExpansion(fac._id)} className="p-1 hover:bg-stone-200 rounded cursor-pointer">
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
                              {/* Origen */}
                              <div className="flex items-center gap-2 text-xs text-stone-500 flex-wrap">
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span>Archivo: <strong>{ar.nombreArchivo}</strong> | Hoja: <strong>{fac.hoja}</strong></span>
                                <button
                                  onClick={() => verEnExcel(fac.hoja, ar.tempFileName)}
                                  className="ml-2 text-sky-600 hover:text-sky-800 underline cursor-pointer text-xs"
                                >
                                  Abrir en Excel
                                </button>
                              </div>

                              {/* Discrepancias */}
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
                                    {fac.advertencias!.map((w: string, wi: number) => <li key={wi} className="text-xs text-sky-700">- {w}</li>)}
                                  </ul>
                                </div>
                              )}

                              {/* Productos */}
                              {fac.productos && fac.productos.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-stone-500 uppercase mb-1 mt-2">Productos Extraídos</p>
                                  <div className="space-y-0.5 bg-white p-2 rounded border border-stone-100">
                                    {fac.productos.map((p: any, pi: number) => (
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
                              {fac.errores && fac.errores.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-rose-600 uppercase mb-1 mt-2">Errores</p>
                                  <ul className="space-y-0.5">{fac.errores.map((err: string, ei: number) => <li key={ei} className="text-xs text-rose-700">- {err}</li>)}</ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        </>
        )}
      </div>
    );
  }

  if (paso === "configurar") {
    return (
      <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto px-2">
        {renderPasos()}
        <div>
          <h2 className="text-xl font-bold text-stone-900">Opciones de Guardado</h2>
          <p className="text-sm text-stone-500">¿Cómo querés agrupar estas {selectedCount} facturas en la base de datos?</p>
        </div>

        <Card className="border border-purple-200 bg-white shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-purple-500 to-purple-800" />
          <CardContent className="p-6">
            <h3 className="font-semibold text-purple-900 mb-5 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Selecciona el destino
            </h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg border border-stone-200 cursor-pointer hover:border-purple-300 transition-colors">
                <input type="radio" name="modo" checked={modo === "un_proyecto"} onChange={() => setModo("un_proyecto")} className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="font-bold text-stone-800">Todo en un solo proyecto</p>
                  <p className="text-sm text-stone-500">Agrega todas las facturas a un mismo proyecto. Luego, usando el botón 'Exportar' (en Consultar), podrás filtrarlas por cliente o fechas y descargar en Excel o BD.</p>
                </div>
              </label>

              {modo === "un_proyecto" && (
                <div className="ml-10 p-4 bg-white border border-stone-200 rounded-lg space-y-4 shadow-inner">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">PROYECTO EXISTENTE</label>
                    <select value={destinoId} onChange={e => setDestinoId(e.target.value)} className="w-full text-sm border-stone-300 rounded-md p-2 border focus:ring-purple-500 focus:border-purple-500">
                      <option value="">-- Seleccionar --</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-px bg-stone-200 flex-1"></div>
                    <span className="text-xs font-medium text-stone-400">O</span>
                    <div className="h-px bg-stone-200 flex-1"></div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">NUEVO PROYECTO</label>
                    <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre para el nuevo proyecto" className="w-full text-sm border-stone-300 rounded-md p-2 border focus:ring-purple-500 focus:border-purple-500" />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg border border-stone-200 cursor-pointer hover:border-purple-300 transition-colors">
                <input type="radio" name="modo" checked={modo === "por_cliente"} onChange={() => setModo("por_cliente")} className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="font-bold text-stone-800">Separar por Clientes</p>
                  <p className="text-sm text-stone-500">Crea un proyecto independiente automáticamente para cada cliente distinto detectado en las facturas.</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-stone-50 rounded-lg border border-stone-200 cursor-pointer hover:border-purple-300 transition-colors">
                <input type="radio" name="modo" checked={modo === "por_archivo"} onChange={() => setModo("por_archivo")} className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="font-bold text-stone-800">Un proyecto por Excel</p>
                  <p className="text-sm text-stone-500">Crea un proyecto independiente por cada archivo Excel (.xlsx) que hayas importado en este lote.</p>
                </div>
              </label>
            </div>

            <div className="mt-8 pt-4 border-t border-stone-100 flex justify-between items-center flex-wrap gap-4">
              <Button variant="ghost" onClick={() => setPaso("revisar_datos")} className="text-stone-500">
                Volver a Revisión
              </Button>
              <Button onClick={confirmarLotes} disabled={importing} className="bg-purple-800 text-white shadow-md hover:bg-purple-900 px-6">
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                Importar {selectedCount} Facturas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paso === "resultado" && resultadoFinal) {
    return (
      <div className="space-y-6 animate-in zoom-in-95 max-w-2xl mx-auto text-center py-12 px-2">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-bold text-stone-900">¡Importación Exitosa!</h2>
        <p className="text-lg text-stone-500 mt-2">
          Se han guardado <span className="font-bold text-purple-700">{resultadoFinal.importadas}</span> facturas en la base de datos.
        </p>
        
        {resultadoFinal.errores.length > 0 && (
          <div className="mt-8 p-5 bg-rose-50 border border-rose-200 rounded-xl text-left shadow-sm">
            <h4 className="font-semibold text-rose-800 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5"/> Hubo algunos avisos de guardado:
            </h4>
            <ul className="text-sm text-rose-700 space-y-1 list-disc pl-5">
              {resultadoFinal.errores.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <Button variant="outline" onClick={() => { setPaso("seleccionar"); setArchivosResult([]); }}>Importar más facturas</Button>
          <Button onClick={() => setActiveTab("proyectos")} className="bg-purple-800 text-white hover:bg-purple-900">Ver mis Proyectos</Button>
        </div>
      </div>
    );
  }

  return null;
}