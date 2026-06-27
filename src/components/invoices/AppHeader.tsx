"use client";

import { useEffect, useState, useRef } from "react";
import { useAppStore, type Tab } from "@/lib/store";
import {
  FileText,
  Upload,
  Search,
  LayoutDashboard,
  Plus,
  ChevronDown,
  FolderPlus,
  Trash2,
  X,
} from "lucide-react";

const tabs: { id: Tab; label: string; icon: React.ReactNode; needsProject: boolean }[] = [
  { id: "dashboard", label: "Inicio", icon: <LayoutDashboard className="w-5 h-5" />, needsProject: false },
  { id: "importar", label: "Importar", icon: <Upload className="w-5 h-5" />, needsProject: true },
  { id: "crear", label: "Crear", icon: <Plus className="w-5 h-5" />, needsProject: true },
  { id: "consultar", label: "Consultar", icon: <Search className="w-5 h-5" />, needsProject: true },
];

export function AppHeader() {
  const { activeTab, setActiveTab, activeProjectId, setActiveProjectId, projects, setProjects } = useAppStore();
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cargar proyectos al montar
  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects).catch(() => {});
  }, [setProjects]);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: newProjectName.trim() }),
      });
      const project = await res.json();
      if (res.ok) {
        setProjects([project, ...projects]);
        setActiveProjectId(project.id);
        setNewProjectName("");
        setShowNew(false);
        setShowProjectMenu(false);
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects(projects.filter((p) => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId(projects.length > 1 ? projects.find((p) => p.id !== id)?.id || null : null);
      }
    } catch { /* ignore */ }
    setDeletingId(null);
  };

  const handleTabClick = (tab: Tab, needsProject: boolean) => {
    if (needsProject && !activeProjectId) {
      setShowProjectMenu(true);
      return;
    }
    setActiveTab(tab);
  };

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo + Project Selector */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-800 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-purple-300 hover:bg-stone-50 transition-all cursor-pointer"
              >
                <span className="font-bold text-stone-900 text-sm">
                  {activeProject ? activeProject.nombre : "Facturas"}
                </span>
                {activeProject && (
                  <span className="text-xs text-stone-400 hidden sm:inline">
                    ({activeProject._count.invoices})
                  </span>
                )}
                <ChevronDown className="w-4 h-4 text-stone-400" />
              </button>

              {showProjectMenu && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-stone-200 rounded-xl shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-2">
                  {/* Proyectos existentes */}
                  <div className="max-h-60 overflow-y-auto">
                    {projects.length === 0 && !showNew && (
                      <div className="px-3 py-4 text-center text-sm text-stone-400">
                        No hay proyectos todavía
                      </div>
                    )}
                    {projects.map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors group ${
                          activeProjectId === p.id ? "bg-purple-50" : "hover:bg-stone-50"
                        }`}
                        onClick={() => {
                          setActiveProjectId(p.id);
                          setShowProjectMenu(false);
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeProjectId === p.id ? "bg-purple-600" : "bg-stone-300"}`} />
                          <span className="text-sm text-stone-800 truncate">{p.nombre}</span>
                          <span className="text-xs text-stone-400">{p._count.invoices}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(p.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-600 text-stone-300 transition-all cursor-pointer"
                          title="Eliminar proyecto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Crear nuevo */}
                  <div className="border-t border-stone-100 pt-1 mt-1">
                    {showNew ? (
                      <div className="px-3 py-2 space-y-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Nombre del proyecto..."
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateProject();
                            if (e.key === "Escape") { setShowNew(false); setNewProjectName(""); }
                          }}
                          className="w-full h-8 px-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleCreateProject}
                            disabled={creating || !newProjectName.trim()}
                            className="flex-1 h-7 bg-purple-800 hover:bg-purple-900 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {creating ? "Creando..." : "Crear"}
                          </button>
                          <button
                            onClick={() => { setShowNew(false); setNewProjectName(""); }}
                            className="h-7 px-2 text-xs text-stone-500 hover:text-stone-700 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowNew(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-4 h-4" />
                        Nuevo proyecto
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id, tab.needsProject)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-purple-800 text-white shadow-md shadow-purple-200"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                }`}
                title={tab.needsProject && !activeProjectId ? "Seleccioná un proyecto primero" : undefined}
              >
                {tab.icon}
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Confirm delete dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-[60] bg-black/30 flex items-center justify-center" onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-stone-900 mb-2">Eliminar proyecto</h3>
            <p className="text-sm text-stone-600 mb-4">
              Se eliminarán todas las facturas de este proyecto. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer">Cancelar</button>
              <button onClick={() => handleDeleteProject(deletingId)} className="px-4 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer font-medium">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}