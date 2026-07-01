import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Database, X, Upload } from "lucide-react";

interface ExportModalProps {
  onClose: () => void;
  projectIds?: string;
}

export function ExportModal({ onClose, projectIds }: ExportModalProps) {
  const { activeProjectId } = useAppStore();
  const { toast } = useToast();
  
  const [formato, setFormato] = useState<"basedatos" | "original" | null>(null);
  const [destino, setDestino] = useState<"nuevo" | "existente" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!formato) return;
    setExporting(true);

    try {
      const base = projectIds ? `?projectIds=${projectIds}` : activeProjectId ? `?projectId=${activeProjectId}` : "?";

      if (formato === "original") {
        const res = await fetch(`/api/invoices/export${base}&format=original`);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        descargarBlob(blob, "Facturas_Original.xlsx");
        toast({ title: "Excel descargado", description: "Formato Plantilla Cucimundo." });
        onClose();
        return;
      }

      if (formato === "basedatos") {
        if (destino === "nuevo") {
          const res = await fetch(`/api/invoices/export${base}`);
          if (!res.ok) throw new Error();
          const blob = await res.blob();
          descargarBlob(blob, "BaseDeDatos.xlsx");
          toast({ title: "Excel descargado", description: "Base de datos nueva generada." });
          onClose();
        } else if (destino === "existente" && file) {
          const formData = new FormData();
          formData.append("file", file);
          if (projectIds) {
             formData.append("projectIds", projectIds);
          } else if (activeProjectId) {
             formData.append("projectId", activeProjectId);
          }

          const res = await fetch(`/api/invoices/export-inject`, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error();
          const blob = await res.blob();
          descargarBlob(blob, `BaseDeDatos_${file.name}`);
          toast({ title: "Excel actualizado", description: "La Base de Datos fue inyectada al inicio sin hoja de trazabilidad." });
          onClose();
        }
      }
    } catch (e) {
      toast({ title: "Error al exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const descargarBlob = (blob: Blob, name: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-stone-900">Exportar Facturas</h2>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* PASO 1: Formato */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-stone-900">1. Seleccioná el formato de exportación</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => { setFormato("basedatos"); setDestino(null); }}
                className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  formato === "basedatos" ? "border-purple-600 bg-purple-50 ring-1 ring-purple-600" : "border-stone-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center gap-2 text-stone-900 font-medium">
                  <Database className={`w-5 h-5 ${formato === "basedatos" ? "text-purple-700" : "text-stone-400"}`} />
                  Base de Datos
                </div>
                <p className="text-xs text-stone-500">Columnas estrictas. Ideal para análisis y contabilidad.</p>
              </button>

              <button
                onClick={() => { setFormato("original"); setDestino(null); }}
                className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                  formato === "original" ? "border-purple-600 bg-purple-50 ring-1 ring-purple-600" : "border-stone-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center gap-2 text-stone-900 font-medium">
                  <FileText className={`w-5 h-5 ${formato === "original" ? "text-purple-700" : "text-stone-400"}`} />
                  Plantilla Idéntica
                </div>
                <p className="text-xs text-stone-500">Una hoja por cada factura con el diseño Cucimundo.</p>
              </button>
            </div>
          </div>

          {/* PASO 2: Destino (Solo si es Base de Datos) */}
          {formato === "basedatos" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-semibold text-stone-900">2. ¿Dónde querés guardar la Base de Datos?</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setDestino("nuevo")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    destino === "nuevo" ? "border-purple-600 bg-purple-50 ring-1 ring-purple-600" : "border-stone-200 hover:border-purple-300"
                  }`}
                >
                  <Download className={`w-5 h-5 ${destino === "nuevo" ? "text-purple-700" : "text-stone-400"}`} />
                  <div>
                    <p className="text-sm font-medium text-stone-900">Archivo Nuevo</p>
                    <p className="text-xs text-stone-500">Descarga un Excel limpio.</p>
                  </div>
                </button>

                <button
                  onClick={() => setDestino("existente")}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                    destino === "existente" ? "border-purple-600 bg-purple-50 ring-1 ring-purple-600" : "border-stone-200 hover:border-purple-300"
                  }`}
                >
                  <Upload className={`w-5 h-5 ${destino === "existente" ? "text-purple-700" : "text-stone-400"}`} />
                  <div>
                    <p className="text-sm font-medium text-stone-900">En archivo original</p>
                    <p className="text-xs text-stone-500">Agrega la Base de Datos al inicio del Excel sin trazabilidad.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: Subir Archivo (Solo si es Existente) */}
          {formato === "basedatos" && destino === "existente" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <label className="text-sm font-semibold text-stone-900">3. Subí el Excel fuente</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer border border-stone-200 rounded-lg p-2"
              />
            </div>
          )}
        </div>

        <div className="p-5 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={!formato || (formato === "basedatos" && !destino) || (destino === "existente" && !file) || exporting}
            className="flex items-center gap-2 px-6 py-2.5 bg-purple-800 hover:bg-purple-900 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-purple-200"
          >
            {exporting ? "Generando..." : "Exportar"}
          </button>
        </div>
      </div>
    </div>
  );
}
