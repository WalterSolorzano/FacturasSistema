"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Check, CheckSquare, Square, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Exportar() {
  const { projects } = useAppStore();
  const { toast } = useToast();
  
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const toggleProject = (id: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProjects.size === projects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(projects.map(p => p.id)));
    }
  };

  const handleExport = (format: "basedatos" | "ambos") => {
    if (selectedProjects.size === 0) return;
    
    setIsExporting(true);
    toast({ title: "Exportando...", description: "Generando archivo Excel, por favor espere." });
    
    const ids = Array.from(selectedProjects).join(",");
    const url = `/api/invoices/export?projectIds=${ids}&format=${format}`;
    
    // Abrir en nueva pestaña para desencadenar descarga
    window.open(url, '_blank');
    
    setTimeout(() => {
      setIsExporting(false);
    }, 2000); // Reset button after a short delay since download happens via window.open
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto pb-10">
      <div>
        <h2 className="text-xl font-bold text-stone-900">Módulo de Exportación</h2>
        <p className="text-sm text-stone-500 mt-0.5">
          Selecciona uno o más proyectos para exportarlos juntos en un solo archivo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-stone-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <h3 className="font-semibold text-stone-800 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-purple-600" />
              Proyectos ({projects.length})
            </h3>
            <button 
              onClick={toggleAll}
              className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
            >
              {selectedProjects.size === projects.length ? (
                <><CheckSquare className="w-4 h-4" /> Deseleccionar Todo</>
              ) : (
                <><Square className="w-4 h-4" /> Seleccionar Todo</>
              )}
            </button>
          </div>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
              {projects.length === 0 ? (
                <div className="p-8 text-center text-stone-500 text-sm">
                  No hay proyectos creados aún.
                </div>
              ) : (
                projects.map(p => {
                  const isSel = selectedProjects.has(p.id);
                  return (
                    <div 
                      key={p.id}
                      onClick={() => toggleProject(p.id)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border border-transparent ${
                        isSel ? "bg-purple-50 border-purple-200" : "hover:bg-stone-50 border-stone-100"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${isSel ? "text-purple-900" : "text-stone-700"}`}>
                          {p.nombre}
                        </p>
                        <p className="text-xs text-stone-400">
                          {p._count?.invoices || 0} facturas
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                        isSel ? "bg-purple-600 border-purple-600 text-white" : "border-stone-300 bg-white"
                      }`}>
                        {isSel && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-stone-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <CardContent className="p-5 flex flex-col h-full">
              <h3 className="font-bold text-stone-800 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Solo Base de Datos
              </h3>
              <p className="text-sm text-stone-500 flex-1 mb-4">
                Genera un Excel con una sola hoja de base de datos tabular que consolida todas las facturas de los proyectos seleccionados. Útil para importar a otros sistemas de gestión o analizar.
              </p>
              <Button 
                onClick={() => handleExport("basedatos")} 
                disabled={selectedProjects.size === 0 || isExporting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar Base de Datos
              </Button>
            </CardContent>
          </Card>

          <Card className="border-stone-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-600" />
            <CardContent className="p-5 flex flex-col h-full">
              <h3 className="font-bold text-stone-800 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-700" />
                Facturas + Base de Datos (Ambos)
              </h3>
              <p className="text-sm text-stone-500 flex-1 mb-4">
                Genera un archivo Excel maestro que contiene la hoja de Base de Datos y además <strong>crea una hoja separada por cada factura original</strong> de todos los proyectos seleccionados, replicando el formato de Cucimundo.
              </p>
              <Button 
                onClick={() => handleExport("ambos")} 
                disabled={selectedProjects.size === 0 || isExporting}
                className="w-full bg-purple-800 hover:bg-purple-900 text-white shadow cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar Formato Completo
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
