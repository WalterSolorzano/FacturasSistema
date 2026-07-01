"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderPlus,
  Layers,
  Loader2,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type DestinationMode = "mismo" | "nuevo" | "carpeta" | "archivo";

interface BatchFileEntry {
  id: string;
  file: File;
  folderLabel: string;
  relativePath: string;
}

interface BatchFacturaPreview {
  numero: string;
  tipo: string;
  fecha: string;
  proveedor: string;
  productos: Array<{
    codigo: string;
    producto: string;
    cantidad: number;
    valorUnit: number;
    subtotal: number;
    _precioCero?: boolean;
  }>;
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
  clienteCodigo?: string;
  clienteDireccion?: string;
  clienteCiudadTel?: string;
  condicionVenta?: string;
  clienteCuit?: string;
  clienteContacto?: string;
  remito?: string;
}

interface BatchAnalysisResult {
  nombreArchivo: string;
  carpeta: string;
  facturas: BatchFacturaPreview[];
  exitosas: number;
  conErrores: number;
  vacias: number;
  totalHojas: number;
  tempFileName: string;
}

interface BatchAnalysisResponse {
  archivos: BatchAnalysisResult[];
  totalArchivos: number;
  totalFacturas: number;
  totalErrores: number;
  error?: string;
}

interface SaveSummary {
  importadas: number;
  omitidasFecha: number;
  errores: string[];
  resumen: string[];
}

function sanitizeProjectName(value: string): string {
  return value.replace(/[\\/*?\[\]:]/g, " ").replace(/\s+/g, " ").trim();
}

function fileKey(file: File): string {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return `${relativePath}__${file.size}__${file.lastModified}`;
}

function uniqueName(base: string, used: Map<string, number>): string {
  const clean = sanitizeProjectName(base) || "Lote";
  const next = (used.get(clean) || 0) + 1;
  used.set(clean, next);
  return next === 1 ? clean : `${clean} (${next})`;
}

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function createProject(nombre: string): Promise<string> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre }),
  });

  const data = await readJsonSafe(response) as { id?: string; error?: string } | null;
  if (!response.ok || !data?.id) {
    throw new Error(data?.error || "No se pudo crear el proyecto.");
  }

  return data.id;
}

async function importFacturas(facturas: BatchFacturaPreview[], projectId: string) {
  let importadas = 0;
  let omitidasFecha = 0;
  const errores: string[] = [];
  const resumen: string[] = [];

  const CHUNK_SIZE = 50;
  for (let index = 0; index < facturas.length; index += CHUNK_SIZE) {
    const chunk = facturas.slice(index, index + CHUNK_SIZE);
    const response = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facturas: chunk, projectId }),
    });

    const data = await readJsonSafe(response) as SaveSummary | { error?: string } | null;
    if (!response.ok) {
      throw new Error((data as { error?: string } | null)?.error || "Error al guardar el lote.");
    }

    const payload = data as SaveSummary;
    importadas += payload.importadas || 0;
    omitidasFecha += payload.omitidasFecha || 0;
    if (Array.isArray(payload.errores)) errores.push(...payload.errores);
    if (Array.isArray(payload.resumen)) resumen.push(...payload.resumen);
  }

  return { importadas, omitidasFecha, errores, resumen };
}

export function ImportarLotes() {
  const { toast } = useToast();
  const { activeProjectId, setActiveProjectId, setActiveTab, triggerRefresh } = useAppStore();

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<BatchFileEntry[]>([]);
  const [analysis, setAnalysis] = useState<Array<BatchAnalysisResult & BatchFileEntry> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [destinationMode, setDestinationMode] = useState<DestinationMode>("mismo");
  const [baseProjectName, setBaseProjectName] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);

  const folderInputProps = { webkitdirectory: "", multiple: true } as any;

  const addFiles = useCallback((list: FileList | File[], fallbackFolder: string) => {
    const nextFiles = Array.from(list)
      .filter((file) => /\.xlsx?$/i.test(file.name))
      .map((file) => {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const folderLabel = relativePath.includes("/") ? relativePath.split("/")[0] : fallbackFolder;
        return {
          id: fileKey(file),
          file,
          folderLabel: folderLabel || "Archivos sueltos",
          relativePath,
        };
      });

    setFiles((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      for (const entry of nextFiles) map.set(entry.id, entry);
      return Array.from(map.values());
    });
  }, []);

  const handleFolderPick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (list && list.length > 0) addFiles(list, "Carpeta");
    event.target.value = "";
  }, [addFiles]);

  const handleFilePick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (list && list.length > 0) addFiles(list, "Archivos sueltos");
    event.target.value = "";
  }, [addFiles]);

  const groupedFiles = useMemo(() => {
    const groups = new Map<string, BatchFileEntry[]>();
    for (const entry of files) {
      const key = entry.folderLabel || "Archivos sueltos";
      const current = groups.get(key) || [];
      current.push(entry);
      groups.set(key, current);
    }
    return Array.from(groups.entries()).map(([folder, groupFiles]) => ({ folder, files: groupFiles }));
  }, [files]);

  const clientStats = useMemo(() => {
    if (!analysis) return [] as Array<{ nombre: string; count: number }>;
    const countByClient = new Map<string, number>();
    for (const file of analysis) {
      for (const factura of file.facturas) {
        if (!factura.exito) continue;
        const nombre = (factura.proveedor || "Sin cliente").trim();
        countByClient.set(nombre, (countByClient.get(nombre) || 0) + 1);
      }
    }

    return Array.from(countByClient.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [analysis]);

  const filteredAnalysis = useMemo(() => {
    if (!analysis) return [] as Array<BatchAnalysisResult & BatchFileEntry>;
    const filter = clientFilter.trim().toLowerCase();
    if (!filter) return analysis;
    return analysis.filter((item) => item.facturas.some((factura) => (factura.proveedor || "").toLowerCase().includes(filter)));
  }, [analysis, clientFilter]);

  const totalFiles = analysis?.length || files.length;
  const totalInvoices = analysis?.reduce((sum, item) => sum + item.exitosas, 0) || 0;
  const totalErrors = analysis?.reduce((sum, item) => sum + item.conErrores, 0) || 0;
  const selectedCount = selectedIds.size;

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setAnalysis(null);
    setSelectedIds(new Set());
    setExpandedIds(new Set());
    setSaveSummary(null);
    setBaseProjectName("");
    setClientFilter("");
    setDestinationMode("mismo");
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const analyzeBatch = useCallback(async () => {
    if (files.length === 0) {
      toast({ title: "Sin archivos", description: "Agregá al menos un Excel para analizar.", variant: "destructive" });
      return;
    }

    setAnalyzing(true);
    setSaveSummary(null);

    try {
      const formData = new FormData();
      files.forEach((entry, index) => {
        formData.append("archivos", entry.file);
        formData.append(`carpeta_${index}`, entry.folderLabel);
      });

      const response = await fetch("/api/import/batch", { method: "POST", body: formData });
      const data = await readJsonSafe(response) as BatchAnalysisResponse | null;

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo analizar el lote.");
      }

      const merged = (data?.archivos || []).map((result, index) => ({
        ...result,
        ...files[index],
      }));

      setAnalysis(merged);
      setSelectedIds(new Set(merged.filter((item) => item.exitosas > 0).map((item) => item.id)));
      toast({ title: "Lote analizado", description: `${merged.length} archivo(s) revisado(s).` });
    } catch (error) {
      toast({
        title: "Error al analizar",
        description: error instanceof Error ? error.message : "No se pudo leer el lote.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  }, [files, toast]);

  const resolveBaseProjectId = useCallback(async () => {
    if (destinationMode === "mismo" && activeProjectId) {
      return activeProjectId;
    }

    const baseName = sanitizeProjectName(baseProjectName) || "Lote importado";
    const projectId = await createProject(baseName);
    setActiveProjectId(projectId);
    return projectId;
  }, [activeProjectId, baseProjectName, destinationMode, setActiveProjectId]);

  const handleImport = useCallback(async () => {
    if (!analysis || selectedCount === 0) {
      toast({ title: "Nada que importar", description: "Seleccioná al menos un archivo.", variant: "destructive" });
      return;
    }

    if (!baseProjectName.trim() && !activeProjectId && destinationMode === "mismo") {
      toast({ title: "Sin proyecto", description: "Definí un nombre para el proyecto destino.", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const selected = analysis.filter((item) => selectedIds.has(item.id));
      const usedNames = new Map<string, number>();
      const totalSummary: SaveSummary = { importadas: 0, omitidasFecha: 0, errores: [], resumen: [] };

      if (destinationMode === "mismo" || destinationMode === "nuevo") {
        const projectId = await resolveBaseProjectId();
        const outcome = await importFacturas(selected.flatMap((item) => item.facturas), projectId);
        totalSummary.importadas += outcome.importadas;
        totalSummary.omitidasFecha += outcome.omitidasFecha;
        totalSummary.errores.push(...outcome.errores);
        totalSummary.resumen.push(...outcome.resumen);
      } else if (destinationMode === "carpeta") {
        const groups = new Map<string, Array<BatchAnalysisResult & BatchFileEntry>>();
        for (const item of selected) {
          const key = item.folderLabel || "Archivos sueltos";
          const current = groups.get(key) || [];
          current.push(item);
          groups.set(key, current);
        }

        const createdProjects: string[] = [];
        for (const [folder, groupFiles] of groups.entries()) {
          const projectName = uniqueName(`${baseProjectName || "Lote"} - ${folder}`, usedNames);
          const projectId = await createProject(projectName);
          createdProjects.push(projectId);
          for (const file of groupFiles) {
            const outcome = await importFacturas(file.facturas, projectId);
            totalSummary.importadas += outcome.importadas;
            totalSummary.omitidasFecha += outcome.omitidasFecha;
            totalSummary.errores.push(...outcome.errores);
            totalSummary.resumen.push(...outcome.resumen);
          }
        }

        if (createdProjects.length > 0) {
          setActiveProjectId(createdProjects[0]);
        }
      } else {
        const createdProjects: string[] = [];
        for (const file of selected) {
          const projectName = uniqueName(`${baseProjectName || "Lote"} - ${file.nombreArchivo.replace(/\.xlsx?$/i, "")}`, usedNames);
          const projectId = await createProject(projectName);
          createdProjects.push(projectId);
          const outcome = await importFacturas(file.facturas, projectId);
          totalSummary.importadas += outcome.importadas;
          totalSummary.omitidasFecha += outcome.omitidasFecha;
          totalSummary.errores.push(...outcome.errores);
          totalSummary.resumen.push(...outcome.resumen);
        }

        if (createdProjects.length > 0) {
          setActiveProjectId(createdProjects[0]);
        }
      }

      setSaveSummary(totalSummary);
      triggerRefresh();
      setActiveTab("consultar");
      toast({ title: "Importación completada", description: `${totalSummary.importadas} factura(s) guardada(s).` });
    } catch (error) {
      toast({
        title: "Error al importar",
        description: error instanceof Error ? error.message : "No se pudo completar la importación.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }, [activeProjectId, analysis, baseProjectName, destinationMode, resolveBaseProjectId, selectedCount, selectedIds, setActiveProjectId, setActiveTab, toast, triggerRefresh]);

  const selectedLabel = destinationMode === "mismo"
    ? "un solo proyecto"
    : destinationMode === "nuevo"
      ? "proyecto nuevo"
      : destinationMode === "carpeta"
        ? "proyecto por carpeta"
        : "proyecto por archivo";

  return (
    <div className="space-y-6 animate-in fade-in max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <Layers className="w-6 h-6 text-purple-700" />
          Importación por lotes
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          Cargá varias carpetas o archivos, analizalos juntos y decidí si quedan en un solo proyecto o separados por carpeta o archivo.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_0.9fr] gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-3">
              <button
                onClick={() => folderInputRef.current?.click()}
                className="rounded-2xl border border-dashed border-purple-300 bg-purple-50/70 hover:bg-purple-50 transition-colors p-5 text-left cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center mb-3">
                  <FolderPlus className="w-5 h-5 text-purple-700" />
                </div>
                <p className="font-semibold text-stone-900">Agregar carpetas</p>
                <p className="text-sm text-stone-500 mt-1">Elegí una carpeta completa. Podés repetir la acción para sumar más carpetas.</p>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 hover:bg-stone-100 transition-colors p-5 text-left cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-stone-100 flex items-center justify-center mb-3">
                  <Upload className="w-5 h-5 text-stone-700" />
                </div>
                <p className="font-semibold text-stone-900">Agregar archivos</p>
                <p className="text-sm text-stone-500 mt-1">También podés sumar Excel sueltos si no vienen dentro de una carpeta.</p>
              </button>
            </div>

            <input ref={folderInputRef} type="file" accept=".xlsx,.xls" onChange={handleFolderPick} className="hidden" {...folderInputProps} />
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple onChange={handleFilePick} className="hidden" />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-stone-900">Archivos cargados</p>
                  <p className="text-xs text-stone-500">{files.length === 0 ? "Todavía no agregaste ningún Excel." : `Se detectaron ${files.length} archivo(s) para analizar.`}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearAll} className="gap-2">
                    <X className="w-4 h-4" /> Limpiar
                  </Button>
                  <Button onClick={analyzeBatch} disabled={analyzing || files.length === 0} className="gap-2 bg-purple-800 hover:bg-purple-900 text-white">
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    {analyzing ? "Analizando..." : "Analizar lote"}
                  </Button>
                </div>
              </div>

              <div className="max-h-[340px] overflow-y-auto divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
                {groupedFiles.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 text-sm">Agregá carpetas o archivos para empezar.</div>
                ) : (
                  groupedFiles.map((group) => {
                    const expanded = expandedIds.has(group.folder);
                    return (
                      <div key={group.folder} className="p-4">
                        <button
                          onClick={() => toggleExpanded(group.folder)}
                          className="w-full flex items-center justify-between gap-3 cursor-pointer text-left"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900 truncate flex items-center gap-2">
                              <FolderOpen className="w-4 h-4 text-purple-700" />
                              {group.folder}
                            </p>
                            <p className="text-xs text-stone-500">{group.files.length} archivo(s)</p>
                          </div>
                          <div className="text-stone-400">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                        </button>

                        {expanded && (
                          <div className="mt-3 space-y-2">
                            {group.files.map((entry) => (
                              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 p-3">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-stone-900 truncate">{entry.file.name}</p>
                                  <p className="text-xs text-stone-500 truncate">{entry.relativePath}</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">{Math.round(entry.file.size / 1024)} KB</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-stone-900">Resumen rápido</p>
                <Badge variant="secondary">{selectedLabel}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-purple-50 p-3">
                  <p className="text-2xl font-bold text-purple-800">{totalFiles}</p>
                  <p className="text-xs text-purple-700">Archivo(s)</p>
                </div>
                <div className="rounded-xl bg-sky-50 p-3">
                  <p className="text-2xl font-bold text-sky-700">{totalInvoices}</p>
                  <p className="text-xs text-sky-600">Factura(s) detectadas</p>
                </div>
                <div className="rounded-xl bg-rose-50 p-3">
                  <p className="text-2xl font-bold text-rose-700">{totalErrors}</p>
                  <p className="text-xs text-rose-600">Con errores</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-2xl font-bold text-emerald-700">{selectedCount}</p>
                  <p className="text-xs text-emerald-600">Seleccionados</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700">Filtrar por cliente</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="h-10 pl-10"
                  />
                </div>
              </div>

              {clientStats.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-stone-700">Clientes más frecuentes</p>
                  <div className="flex flex-wrap gap-2">
                    {clientStats.map((item) => (
                      <Badge key={item.nombre} variant="secondary" className="gap-1">
                        <ShieldCheck className="w-3 h-3" /> {item.nombre} · {item.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <p className="font-semibold text-stone-900">Destino de importación</p>
              <div className="space-y-2">
                {[
                  { value: "mismo", label: "Todo en un solo proyecto", description: "Agrupa todo en un único proyecto para luego filtrar por cliente o archivo." },
                  { value: "nuevo", label: "Crear un proyecto nuevo", description: "Arranca con un proyecto limpio para este lote." },
                  { value: "carpeta", label: "Separar por carpeta", description: "Cada carpeta se guarda en un proyecto distinto." },
                  { value: "archivo", label: "Separar por archivo", description: "Cada Excel se guarda como un proyecto propio." },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDestinationMode(option.value as DestinationMode)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors cursor-pointer ${destinationMode === option.value ? "border-purple-600 bg-purple-50" : "border-stone-200 hover:border-purple-300"}`}
                  >
                    <p className="text-sm font-medium text-stone-900">{option.label}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{option.description}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-700">Nombre base del proyecto</label>
                <Input
                  value={baseProjectName}
                  onChange={(e) => setBaseProjectName(e.target.value)}
                  placeholder={activeProjectId ? "Usará el proyecto activo" : "Ej. Lote Junio"}
                  className="h-10"
                />
                <p className="text-[11px] text-stone-400">Si elegís separar por carpeta o archivo, se crea un proyecto por grupo usando este nombre como prefijo.</p>
              </div>

              <Button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="w-full gap-2 bg-purple-800 hover:bg-purple-900 text-white"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {importing ? "Importando..." : "Importar lote"}
              </Button>

              {saveSummary && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <p className="font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Importación completada
                  </p>
                  <p className="text-sm text-emerald-700">{saveSummary.importadas} factura(s) guardada(s).</p>
                  {saveSummary.omitidasFecha > 0 && <p className="text-xs text-emerald-600">{saveSummary.omitidasFecha} con fecha dudosa o sin fecha válida.</p>}
                  {saveSummary.resumen.length > 0 && (
                    <ul className="text-xs text-emerald-700 space-y-1 max-h-32 overflow-y-auto">
                      {saveSummary.resumen.map((line, index) => <li key={index}>• {line}</li>)}
                    </ul>
                  )}
                  {saveSummary.errores.length > 0 && (
                    <div className="rounded-lg bg-white/70 p-3 border border-emerald-100">
                      <p className="text-xs font-semibold text-rose-700 mb-2">Errores</p>
                      <ul className="text-xs text-rose-600 space-y-1 max-h-28 overflow-y-auto">
                        {saveSummary.errores.map((line, index) => <li key={index}>• {line}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {analysis && filteredAnalysis.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-stone-900">Revisión del lote</p>
                <p className="text-xs text-stone-500">Seleccioná los archivos que sí querés guardar.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Badge variant="secondary">{selectedCount} seleccionados</Badge>
                <Badge variant="secondary">{filteredAnalysis.length} visibles</Badge>
              </div>
            </div>

            <div className="space-y-3">
              {filteredAnalysis.map((file) => {
                const isSelected = selectedIds.has(file.id);
                const expanded = expandedIds.has(file.id);
                const fileWarnings = file.facturas.flatMap((factura) => factura.errores || []);

                return (
                  <div key={file.id} className={`rounded-2xl border p-4 ${isSelected ? "border-purple-300 bg-purple-50/40" : "border-stone-200 bg-white"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <button onClick={() => toggleSelected(file.id)} className="flex-1 text-left cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? "bg-purple-200 text-purple-800" : "bg-stone-100 text-stone-500"}`}>
                            {isSelected ? <CheckCircle2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-stone-900 truncate">{file.nombreArchivo}</p>
                            <p className="text-xs text-stone-500 truncate">{file.carpeta || "Archivos sueltos"}</p>
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2 flex-wrap justify-end">
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200">{file.exitosas} OK</Badge>
                          {file.conErrores > 0 && <Badge className="bg-rose-100 text-rose-700 border-rose-200">{file.conErrores} error(es)</Badge>}
                          {file.vacias > 0 && <Badge className="bg-stone-100 text-stone-600 border-stone-200">{file.vacias} vacía(s)</Badge>}
                        </div>
                        <button
                          onClick={() => toggleExpanded(file.id)}
                          className="text-xs text-purple-700 hover:text-purple-800 cursor-pointer flex items-center gap-1"
                        >
                          {expanded ? "Ver menos" : "Ver detalle"}
                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div className="rounded-xl bg-stone-50 p-3">
                            <p className="text-xs text-stone-500">Hojas</p>
                            <p className="font-semibold text-stone-900">{file.totalHojas}</p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-xs text-emerald-600">Importables</p>
                            <p className="font-semibold text-emerald-800">{file.exitosas}</p>
                          </div>
                          <div className="rounded-xl bg-rose-50 p-3">
                            <p className="text-xs text-rose-600">Errores</p>
                            <p className="font-semibold text-rose-700">{file.conErrores}</p>
                          </div>
                          <div className="rounded-xl bg-sky-50 p-3">
                            <p className="text-xs text-sky-600">Cliente detectado</p>
                            <p className="font-semibold text-sky-700 truncate">{file.facturas.find((factura) => factura.proveedor)?.proveedor || "Sin cliente"}</p>
                          </div>
                        </div>

                        {fileWarnings.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" /> Observaciones del archivo
                            </p>
                            <ul className="space-y-1 text-xs text-amber-700 max-h-36 overflow-y-auto">
                              {fileWarnings.slice(0, 8).map((warning, index) => <li key={index}>• {warning}</li>)}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs text-stone-500">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          El análisis sólo lee el Excel. Nada se guarda hasta que apretás importar.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {files.length > 0 && analysis === null && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 border border-sky-200">
          <ShieldCheck className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-sky-800">
            Podés agregar varias carpetas una por una. Después decidís si queda <strong>todo en un solo proyecto</strong> o separado por <strong>carpeta</strong> o <strong>archivo</strong>. Si dejás todo junto, después filtrás por cliente desde Consultar.
          </p>
        </div>
      )}
    </div>
  );
}