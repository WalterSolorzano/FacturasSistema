export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = {};
    if (projectId) {
      where.projectId = projectId;
    }

    // Traer todas las facturas del proyecto (o globales) para hacer cálculos
    // En SQLite/Prisma el aggregate por fecha es más fácil hacerlo en memoria
    const facturas = await db.invoice.findMany({
      where,
      select: {
        id: true,
        proveedor: true,
        total: true,
        fechaEmision: true,
      },
    });

    // 1. Mejor Cliente (Proveedor con más facturación)
    const clientesMap = new Map<string, number>();
    for (const f of facturas) {
      const p = f.proveedor.trim() || "(Sin cliente)";
      clientesMap.set(p, (clientesMap.get(p) || 0) + f.total);
    }
    const mejoresClientes = Array.from(clientesMap.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // top 5 clientes

    // 2. Facturación por Mes (del año actual)
    const yearActual = new Date().getFullYear();
    const facturacionPorMesMap = new Map<number, number>();
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    // Inicializar todos los meses en 0
    for (let i = 0; i < 12; i++) facturacionPorMesMap.set(i, 0);

    for (const f of facturas) {
      const d = new Date(f.fechaEmision);
      if (d.getFullYear() === yearActual) {
        const m = d.getMonth();
        facturacionPorMesMap.set(m, (facturacionPorMesMap.get(m) || 0) + f.total);
      }
    }
    const facturacionPorMes = Array.from(facturacionPorMesMap.entries()).map(([m, total]) => ({
      mes: mesesNombres[m],
      total,
    }));

    // 3. Facturación por Año
    const facturacionPorYearMap = new Map<number, number>();
    for (const f of facturas) {
      const d = new Date(f.fechaEmision);
      const y = d.getFullYear();
      if (y > 1990) { // Ignorar fechas inválidas (como 1970)
        facturacionPorYearMap.set(y, (facturacionPorYearMap.get(y) || 0) + f.total);
      }
    }
    const facturacionPorYear = Array.from(facturacionPorYearMap.entries())
      .map(([year, total]) => ({ year: String(year), total }))
      .sort((a, b) => Number(a.year) - Number(b.year));

    return NextResponse.json({
      mejoresClientes,
      facturacionPorMes,
      facturacionPorYear,
    });
  } catch (error) {
    console.error("Error al obtener estadísticas avanzadas:", error);
    return NextResponse.json(
      { error: "Error interno al obtener estadísticas avanzadas." },
      { status: 500 }
    );
  }
}
