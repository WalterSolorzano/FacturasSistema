"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, Award, Calendar, AlertCircle } from "lucide-react";

interface AdvancedStats {
  mejoresClientes: { nombre: string; total: number }[];
  facturacionPorMes: { mes: string; total: number }[];
  facturacionPorYear: { year: string; total: number }[];
}

const COLORS = ["#6b21a8", "#9333ea", "#a855f7", "#c084fc", "#d8b4fe"]; // Purple palette

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
      <div className="bg-white p-3 border border-stone-200 rounded-lg shadow-lg">
        <p className="font-semibold text-stone-900 mb-1">{label}</p>
        <p className="text-purple-700 font-bold">
          {formatMoney(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export function Stats() {
  const { activeProjectId, refreshKey } = useAppStore();
  const [data, setData] = useState<AdvancedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = activeProjectId ? `?projectId=${activeProjectId}` : "";
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
  }, [activeProjectId, refreshKey]);

  if (loading) {
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

  if (!data || (data.facturacionPorMes.every(d => d.total === 0) && data.mejoresClientes.length === 0)) {
    return (
      <div className="space-y-6 animate-in fade-in">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Análisis y Estadísticas</h2>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="text-lg font-semibold text-stone-900 mb-2">No hay suficientes datos</h3>
            <p className="text-stone-500">
              Registrá más facturas para poder visualizar los gráficos y estadísticas del proyecto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-xl font-bold text-stone-900">Análisis y Estadísticas</h2>
        <p className="text-sm text-stone-500 mt-0.5">
          Resumen visual del rendimiento financiero
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Clientes */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Award className="w-4 h-4 text-amber-600" />
              </div>
              <CardTitle className="text-lg text-stone-800">Mejores Clientes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.mejoresClientes} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e5e4" />
                  <XAxis type="number" tickFormatter={(v) => `$${v / 1000}k`} stroke="#a8a29e" fontSize={12} />
                  <YAxis dataKey="nombre" type="category" width={100} stroke="#a8a29e" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {data.mejoresClientes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Evolución Mensual */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-700" />
              </div>
              <CardTitle className="text-lg text-stone-800">Evolución {new Date().getFullYear()}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.facturacionPorMes} margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis dataKey="mes" stroke="#a8a29e" fontSize={12} />
                  <YAxis tickFormatter={(v) => `$${v / 1000}k`} stroke="#a8a29e" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="total" stroke="#7e22ce" strokeWidth={3} dot={{ r: 4, fill: "#7e22ce" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Comparativa por Año */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <CardTitle className="text-lg text-stone-800">Histórico por Año</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.facturacionPorYear} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis dataKey="year" stroke="#a8a29e" fontSize={12} />
                  <YAxis tickFormatter={(v) => `$${v / 1000}k`} stroke="#a8a29e" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" fill="#0284c7" radius={[4, 4, 0, 0]}>
                     {data.facturacionPorYear.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === data.facturacionPorYear.length - 1 ? "#7e22ce" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
