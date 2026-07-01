"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { TrendingUp, Award, AlertCircle, ShoppingBag, TrendingDown, Calendar, Filter, ChevronDown, Check } from "lucide-react";

interface AdvancedStats {
  mejoresClientes: { nombre: string; total: number }[];
  facturacionPorMes: { mes: string; total: number }[];
  facturacionPorYear: { year: string; total: number }[];
  mejoresProductos: { nombre: string; cantidad: number }[];
  mesMasVendido: { mes: string; total: number };
  mesMenosVendido: { mes: string; total: number };
  yearMasVendido: { year: string; total: number };
  yearMenosVendido: { year: string; total: number };
}

const COLORS = ["#6b21a8", "#9333ea", "#a855f7", "#c084fc", "#d8b4fe"];
const PIE_COLORS = ["#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd", "#e0f2fe"];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-stone-200 rounded-lg shadow-lg z-50 relative">
        <p className="font-semibold text-stone-900 mb-1">{label}</p>
        <p className="text-purple-700 font-bold">
          {payload[0].name === "cantidad" 
            ? `${payload[0].value} unid.` 
            : formatMoney(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export function Stats() {
  const { activeProjectId, refreshKey, projects } = useAppStore();
  
  const [selectedProjects, setSelectedProjects] = useState<string[]>(activeProjectId ? [activeProjectId] : []);
  const [data, setData] = useState<AdvancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [filtroEvolucion, setFiltroEvolucion] = useState<"mes"|"year">("mes");
  const [showProjectFilter, setShowProjectFilter] = useState(false);

  useEffect(() => {
    // If activeProjectId changes globally, update our local array ONLY if it's not already in there
    if (activeProjectId && !selectedProjects.includes(activeProjectId)) {
      setSelectedProjects([activeProjectId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    
    let params = "";
    if (selectedProjects.length > 0) {
      params = `?projectIds=${selectedProjects.join(",")}`;
    }

    fetch(`/api/stats/advanced${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjects, refreshKey]);

  const toggleProject = (id: string) => {
    setSelectedProjects(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedProjects(projects.map(p => p.id));
  const clearAll = () => setSelectedProjects([]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Análisis y Estadísticas</h2>
          <p className="text-sm text-stone-500 mt-0.5">Cargando datos...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const isEmpty = !data || (data.facturacionPorMes.every(d => d.total === 0) && data.mejoresClientes.length === 0);

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      <div className="flex items-center justify-between flex-wrap gap-4 relative">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Análisis y Estadísticas</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Resumen visual y métricas de impacto
          </p>
        </div>

        <div className="relative z-40">
          <Button 
            variant="outline" 
            onClick={() => setShowProjectFilter(!showProjectFilter)}
            className="bg-white border-stone-200 text-stone-700 font-medium"
          >
            <Filter className="w-4 h-4 mr-2" />
            {selectedProjects.length === 0 ? "Todos los proyectos" : 
             selectedProjects.length === 1 ? "1 proyecto seleccionado" : 
             `${selectedProjects.length} proyectos`}
            <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
          </Button>

          {showProjectFilter && (
            <div className="absolute right-0 top-12 w-72 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95">
              <div className="p-3 bg-stone-50 border-b border-stone-100 flex justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-8 text-purple-700">Todos</Button>
                <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-8 text-stone-500">Ninguno</Button>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {projects.map(p => {
                  const isSel = selectedProjects.includes(p.id);
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => toggleProject(p.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isSel ? "bg-purple-50" : "hover:bg-stone-50"}`}
                    >
                      <span className={`text-sm ${isSel ? "font-semibold text-purple-900" : "text-stone-700"}`}>{p.nombre}</span>
                      {isSel && <Check className="w-4 h-4 text-purple-600" />}
                    </div>
                  );
                })}
                {projects.length === 0 && <p className="text-xs text-stone-400 p-2 text-center">No hay proyectos.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlay click to close dropdown */}
      {showProjectFilter && (
        <div className="fixed inset-0 z-30" onClick={() => setShowProjectFilter(false)} />
      )}

      {isEmpty ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">No hay suficientes datos</h3>
            <p className="text-stone-500">
              Registrá más facturas o selecciona otros proyectos para poder visualizar los gráficos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* WOW CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <CardContent className="p-5 relative overflow-hidden">
                <TrendingUp className="w-24 h-24 absolute -bottom-4 -right-4 opacity-20" />
                <p className="text-emerald-100 font-medium text-sm">Mes Récord (Histórico)</p>
                <h3 className="text-2xl font-bold mt-1">{data?.mesMasVendido.mes}</h3>
                <p className="text-lg font-semibold mt-2">{formatMoney(data?.mesMasVendido.total || 0)}</p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-500 to-red-600 text-white">
              <CardContent className="p-5 relative overflow-hidden">
                <TrendingDown className="w-24 h-24 absolute -bottom-4 -right-4 opacity-20" />
                <p className="text-rose-100 font-medium text-sm">Mes Más Bajo (Histórico)</p>
                <h3 className="text-2xl font-bold mt-1">{data?.mesMenosVendido.mes}</h3>
                <p className="text-lg font-semibold mt-2">{formatMoney(data?.mesMenosVendido.total || 0)}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
              <CardContent className="p-5 relative overflow-hidden">
                <Award className="w-24 h-24 absolute -bottom-4 -right-4 opacity-20" />
                <p className="text-indigo-100 font-medium text-sm">Año Récord</p>
                <h3 className="text-2xl font-bold mt-1">{data?.yearMasVendido.year}</h3>
                <p className="text-lg font-semibold mt-2">{formatMoney(data?.yearMasVendido.total || 0)}</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <CardContent className="p-5 relative overflow-hidden">
                <AlertCircle className="w-24 h-24 absolute -bottom-4 -right-4 opacity-20" />
                <p className="text-amber-100 font-medium text-sm">Peor Año</p>
                <h3 className="text-2xl font-bold mt-1">{data?.yearMenosVendido.year}</h3>
                <p className="text-lg font-semibold mt-2">{formatMoney(data?.yearMenosVendido.total || 0)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Evolución Dinámica */}
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-purple-700" />
                    </div>
                    <CardTitle className="text-lg text-stone-800">Evolución de Facturación</CardTitle>
                  </div>
                  <div className="bg-stone-100 p-1 rounded-lg flex gap-1">
                    <button 
                      onClick={() => setFiltroEvolucion("mes")}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${filtroEvolucion === "mes" ? "bg-white shadow-sm text-purple-700" : "text-stone-500 hover:text-stone-700"}`}
                    >
                      Mensual (Año actual)
                    </button>
                    <button 
                      onClick={() => setFiltroEvolucion("year")}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${filtroEvolucion === "year" ? "bg-white shadow-sm text-purple-700" : "text-stone-500 hover:text-stone-700"}`}
                    >
                      Histórico por Año
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] mt-4">
                  {loading ? (
                    <Skeleton className="w-full h-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={filtroEvolucion === "mes" ? data?.facturacionPorMes : data?.facturacionPorYear} 
                        margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                        <XAxis dataKey={filtroEvolucion === "mes" ? "mes" : "year"} stroke="#a8a29e" fontSize={12} />
                        <YAxis tickFormatter={(v) => `$${v / 1000}k`} stroke="#a8a29e" fontSize={12} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="total" stroke="#7e22ce" strokeWidth={3} dot={{ r: 4, fill: "#7e22ce" }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top 5 Clientes */}
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Award className="w-4 h-4 text-amber-600" />
                  </div>
                  <CardTitle className="text-lg text-stone-800">Mejores Clientes (Total Facturado)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.mejoresClientes} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
                      <XAxis type="number" tickFormatter={(v) => `$${v / 1000}k`} stroke="#a8a29e" fontSize={12} />
                      <YAxis dataKey="nombre" type="category" width={100} stroke="#a8a29e" fontSize={12} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {data?.mejoresClientes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Productos más vendidos */}
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-sky-600" />
                  </div>
                  <CardTitle className="text-lg text-stone-800">Productos Más Vendidos (Unidades)</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.mejoresProductos}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="cantidad"
                        nameKey="nombre"
                        label={({ name, percent }) => `${name.substring(0, 15)}... (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {data?.mejoresProductos.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  );
}
