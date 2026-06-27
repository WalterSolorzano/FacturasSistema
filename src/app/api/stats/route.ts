import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const totalFacturas = await db.invoice.count();
    const sumaTotales = await db.invoice.aggregate({
      _sum: { total: true },
    });
    const proveedoresUnicos = await db.invoice.groupBy({
      by: ["proveedor"],
    });
    const totalProductos = await db.invoiceItem.count();
    const totalUnidades = await db.invoiceItem.aggregate({
      _sum: { cantidad: true },
    });

    // Facturas del mes actual
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const facturasMes = await db.invoice.count({
      where: { fechaEmision: { gte: inicioMes } },
    });
    const totalMes = await db.invoice.aggregate({
      where: { fechaEmision: { gte: inicioMes } },
      _sum: { total: true },
    });

    // Últimas 5 facturas
    const ultimasFacturas = await db.invoice.findMany({
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