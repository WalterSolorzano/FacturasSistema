"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Database, Download, CheckSquare, Square, Folder } from "lucide-react";
import { ExportModal } from "./ExportModal";

export function BasesDeDatos() {
  const { projects } = useAppStore();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const toggleProject = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)));
    }
  };

  const [showModal, setShowModal] = useState(false);

  const handleDownload = () => {
    if (selectedIds.size === 0) return;
    setShowModal(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-purple-700" />
          Bases de Datos
        </h2>
        <p className="text-sm text-stone-500 mt-1">
          Seleccioná uno o más proyectos para unificar sus facturas en un solo archivo Excel de base de datos.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b border-stone-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Proyectos Disponibles</CardTitle>
            <button
              onClick={selectAll}
              className="text-sm text-purple-700 hover:text-purple-800 font-medium cursor-pointer flex items-center gap-1.5"
            >
              {selectedIds.size === projects.length ? (
                <><CheckSquare className="w-4 h-4" /> Deseleccionar Todos</>
              ) : (
                <><CheckSquare className="w-4 h-4" /> Seleccionar Todos</>
              )}
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-stone-100 max-h-[500px] overflow-y-auto">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-sm">
                No hay proyectos creados todavía.
              </div>
            ) : (
              projects.map((project) => {
                const isSelected = selectedIds.has(project.id);
                return (
                  <div
                    key={project.id}
                    onClick={() => toggleProject(project.id)}
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                      isSelected ? "bg-purple-50/50 hover:bg-purple-50" : "hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-stone-400 ${isSelected ? "text-purple-700" : ""}`}>
                        {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-purple-200" : "bg-stone-100"}`}>
                          <Folder className={`w-5 h-5 ${isSelected ? "text-purple-800" : "text-stone-500"}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-stone-900">{project.nombre}</p>
                          <p className="text-xs text-stone-500">{project._count.invoices} facturas registradas</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleDownload}
          disabled={selectedIds.size === 0 || downloading}
          className="flex items-center gap-2 px-6 py-3 bg-purple-800 hover:bg-purple-900 text-white rounded-xl font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-purple-200"
        >
          <Download className="w-5 h-5" />
          {downloading ? "Generando..." : `Exportar seleccionadas (${selectedIds.size})`}
        </button>
      </div>

      {showModal && (
        <ExportModal 
          onClose={() => setShowModal(false)} 
          projectIds={Array.from(selectedIds).join(",")} 
        />
      )}
    </div>
  );
}
