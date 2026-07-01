export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const projectIds = searchParams.get("projectIds");

    const where: Record<string, unknown> = {};
    if (projectIds) {
      where.projectId = { in: projectIds.split(",") };
    } else if (projectId) {
      where.projectId = projectId;
    }

    const facturas = await db.invoice.findMany({
      where,
      select: {
        id: true,
        proveedor: true,
        total: true,
        fechaEmision: true,
        items: {
          select: { producto: true, cantidad: true, subtotal: true }
        }
      },
    });

    const clientesMap = new Map<string, number>();
    const facturacionPorMesMap = new Map<number, number>();
    const facturacionPorYearMap = new Map<number, number>();
    const productosMap = new Map<string, number>();

    const yearActual = new Date().getFullYear();
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    for (let i = 0; i < 12; i++) facturacionPorMesMap.set(i, 0);

    for (const f of facturas) {
      // Clientes
      const p = f.proveedor.trim() || "(Sin cliente)";
      clientesMap.set(p, (clientesMap.get(p) || 0) + f.total);

      // Fechas
      const d = new Date(f.fechaEmision);
      const y = d.getFullYear();
      if (y > 1990) { 
        // Meses año actual
        if (y === yearActual) {
          const m = d.getMonth();
          facturacionPorMesMap.set(m, (facturacionPorMesMap.get(m) || 0) + f.total);
        }
        // Años
        facturacionPorYearMap.set(y, (facturacionPorYearMap.get(y) || 0) + f.total);
      }

      // Productos
      for (const item of f.items) {
        const prod = item.producto.trim() || "(Sin nombre)";
        productosMap.set(prod, (productosMap.get(prod) || 0) + item.cantidad);
      }
    }

    const mejoresClientes = Array.from(clientesMap.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const facturacionPorMes = Array.from(facturacionPorMesMap.entries()).map(([m, total]) => ({
      mes: mesesNombres[m],
      total,
    }));

    const facturacionPorYear = Array.from(facturacionPorYearMap.entries())
      .map(([year, total]) => ({ year: String(year), total }))
      .sort((a, b) => Number(a.year) - Number(b.year));

    const mejoresProductos = Array.from(productosMap.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    // Globales
    let mesMasVendido = { mes: "-", total: 0 };
    let mesMenosVendido = { mes: "-", total: Infinity };
    facturacionPorMes.forEach(m => {
      if (m.total > mesMasVendido.total) mesMasVendido = m;
      if (m.total < mesMenosVendido.total && m.total > 0) mesMenosVendido = m;
    });
    if (mesMenosVendido.total === Infinity) mesMenosVendido = { mes: "-", total: 0 };

    let yearMasVendido = { year: "-", total: 0 };
    let yearMenosVendido = { year: "-", total: Infinity };
    facturacionPorYear.forEach(y => {
      if (y.total > yearMasVendido.total) yearMasVendido = y;
      if (y.total < yearMenosVendido.total && y.total > 0) yearMenosVendido = y;
    });
    if (yearMenosVendido.total === Infinity) yearMenosVendido = { year: "-", total: 0 };

    return NextResponse.json({
      mejoresClientes,
      facturacionPorMes,
      facturacionPorYear,
      mejoresProductos,
      mesMasVendido,
      mesMenosVendido,
      yearMasVendido,
      yearMenosVendido
    });
  } catch (error) {
    console.error("Error al obtener estadísticas avanzadas:", error);
    return NextResponse.json(
      { error: "Error interno al obtener estadísticas avanzadas." },
      { status: 500 }
    );
  }
}
