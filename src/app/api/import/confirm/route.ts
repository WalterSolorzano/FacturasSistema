import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { FacturaExtraida } from "@/lib/extractor";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { facturas }: { facturas: FacturaExtraida[] } = body;

    if (!facturas || facturas.length === 0) {
      return NextResponse.json(
        { error: "No hay facturas para guardar." },
        { status: 400 }
      );
    }

    // Solo importar las exitosas
    const exitosas = facturas.filter((f) => f.exito);

    if (exitosas.length === 0) {
      return NextResponse.json(
        { error: "Ninguna factura se pudo extraer correctamente." },
        { status: 400 }
      );
    }

    let importadas = 0;
    let duplicadas = 0;

    for (const fac of exitosas) {
      // Verificar si ya existe
      const existente = await db.invoice.findFirst({
        where: { numero: fac.numero },
      });

      if (existente) {
        duplicadas++;
        continue;
      }

      await db.invoice.create({
        data: {
          numero: fac.numero,
          tipo: fac.tipo,
          fechaEmision: fac.fecha ? new Date(fac.fecha) : new Date(),
          cliente: fac.cliente,
          total: fac.total,
          items: {
            create: fac.productos.map((p) => ({
              codigo: p.codigo,
              producto: p.producto,
              cantidad: p.cantidad,
              talla: p.talla,
              valorUnit: p.valorUnit,
              subtotal: p.subtotal,
            })),
          },
        },
      });
      importadas++;
    }

    return NextResponse.json({
      importadas,
      duplicadas,
      omitidas: exitosas.length - importadas - duplicadas,
    });
  } catch (error) {
    console.error("Error al confirmar importación:", error);
    return NextResponse.json(
      { error: "Error interno al guardar las facturas." },
      { status: 500 }
    );
  }
}