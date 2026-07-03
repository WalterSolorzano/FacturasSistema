"use client";

import { useAppStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Calendar, FileText, Trash2, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

export function Proyectos() {
  const { projects, setActiveProjectId, setActiveTab, setProjects } = useAppStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpen = (id: string) => {
    setActiveProjectId(id);
    setActiveTab("dashboard");
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects(projects.filter((p) => p.id !== id));
    } catch { /* ignore */ }
    setDeletingId(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Módulo de Proyectos</h2>
          <p className="text-sm text-stone-500">
            Visualiza y administra todos tus proyectos y clientes en un solo lugar.
          </p>
        </div>
        <Button onClick={() => setActiveTab("importar")} className="bg-purple-800 hover:bg-purple-900 text-white shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Proyecto
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-900">No hay proyectos</h3>
          <p className="text-stone-500 max-w-sm mx-auto">
            Aún no has creado ningún proyecto ni has importado facturas. Ve a la pestaña de Importar para comenzar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <Card key={p.id} className="hover:border-purple-300 hover:shadow-md transition-all group overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-500" />
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 text-lg line-clamp-1" title={p.nombre}>{p.nombre}</h3>
                      <div className="flex items-center gap-1 text-xs text-stone-500 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-6 text-sm text-stone-600 bg-stone-50 p-3 rounded-lg border border-stone-100">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <span className="font-semibold text-stone-900">{p._count?.invoices || 0}</span>
                  facturas registradas
                </div>

                <div className="flex items-center justify-between gap-2 pt-4 border-t border-stone-100">
                  <button
                    onClick={() => setDeletingId(p.id)}
                    className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="Eliminar proyecto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Button 
                    onClick={() => handleOpen(p.id)} 
                    variant="outline"
                    className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    Abrir Proyecto <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogo de eliminación */}
      {deletingId && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center backdrop-blur-sm" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-stone-900 mb-2">Eliminar Proyecto</h3>
            <p className="text-sm text-stone-600 mb-6">
              ¿Estás seguro de que deseas eliminar este proyecto y TODAS sus facturas? Esta acción es irreversible.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeletingId(null)}>Cancelar</Button>
              <Button onClick={() => handleDelete(deletingId)} className="bg-rose-600 hover:bg-rose-700 text-white">Eliminar Permanente</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
