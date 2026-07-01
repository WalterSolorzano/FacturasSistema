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

    const totalFacturas = await db.invoice.count({ where });
    const sumaTotales = await db.invoice.aggregate({
      where,
      _sum: { total: true },
    });
    const proveedoresUnicos = await db.invoice.groupBy({
      where,
      by: ["proveedor"],
    });

    // CORREGIDO: buscar items solo de las facturas del proyecto
    const totalProductos = await db.invoiceItem.count({
      where: projectId
        ? { invoice: { projectId } }
        : {},
    });
    const totalUnidades = await db.invoiceItem.aggregate({
      where: projectId
        ? { invoice: { projectId } }
        : {},
      _sum: { cantidad: true },
    });

    // Facturas del mes actual
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const whereMes = { ...where, fechaEmision: { gte: inicioMes } };
    const facturasMes = await db.invoice.count({ where: whereMes });
    const totalMes = await db.invoice.aggregate({
      where: whereMes,
      _sum: { total: true },
    });

    // Últimas 5 facturas
    const ultimasFacturas = await db.invoice.findMany({
      where,
      include: { items: true },
      orderBy: { fechaEmision: "desc" },
      take: 5,
    });

    return NextResponse.json({
      totalFacturas,
      totalFacturado: sumaTotales._sum.total || 0,
      proveedoresUnicos: proveedoresUnicos.length,
      totalProductos,
      totalUnidades: totalUnidades._sum.cantidad || 0,
      facturasMes,
      totalMes: totalMes._sum.total || 0,
      ultimasFacturas,
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    return NextResponse.json(
      { error: "Error interno al obtener estadísticas." },
      { status: 500 }
    );
  }
}