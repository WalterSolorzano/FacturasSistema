import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const totalFacturas = await db.invoice.count();
    const sumaTotales = await db.invoice.aggregate({
      _sum: { total: true },
    });
    const clientesUnicos = await db.invoice.groupBy({
      by: ["cliente"],
    });
    const totalProductos = await db.invoiceItem.count();

    // Facturas de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const facturasHoy = await db.invoice.count({
      where: {
        fechaEmision: { gte: hoy, lt: manana },
      },
    });

    // Total facturado hoy
    const totalHoy = await db.invoice.aggregate({
      where: {
        fechaEmision: { gte: hoy, lt: manana },
      },
      _sum: { total: true },
    });

    // Últimas 5 facturas
    const ultimasFacturas = await db.invoice.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      totalFacturas,
      totalFacturado: sumaTotales._sum.total || 0,
      clientesUnicos: clientesUnicos.length,
      totalProductos,
      facturasHoy,
      totalHoy: totalHoy._sum.total || 0,
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