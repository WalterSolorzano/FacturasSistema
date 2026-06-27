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

    const exitosas = facturas.filter((f) => f.exito);

    if (exitosas.length === 0) {
      return NextResponse.json(
        { error: "Ninguna factura se pudo extraer correctamente." },
        { status: 400 }
      );
    }

    let importadas = 0;
    let duplicadas = 0;
    let erroresDetalle: string[] = [];

    for (const fac of exitosas) {
      try {
        // Verificar si ya existe por número
        const existente = await db.invoice.findFirst({
          where: { numero: fac.numero },
        });

        if (existente) {
          duplicadas++;
          continue;
        }

        // Validaciones de seguridad
        if (fac.productos.length === 0) {
          erroresDetalle.push(`${fac.numero}: sin productos`);
          continue;
        }

        await db.invoice.create({
          data: {
            numero: fac.numero,
            tipo: fac.tipo,
            fechaEmision: fac.fecha ? new Date(fac.fecha) : new Date(),
            proveedor: fac.proveedor,
            total: fac.total,
            items: {
              create: fac.productos.map((p) => ({
                codigo: p.codigo,
                producto: p.producto,
                cantidad: p.cantidad,
                valorUnit: p.valorUnit,
                subtotal: p.subtotal,
              })),
            },
          },
        });
        importadas++;
      } catch (err) {
        erroresDetalle.push(`${fac.numero}: error al guardar`);
      }
    }

    return NextResponse.json({
      importadas,
      duplicadas,
      errores: erroresDetalle,
    });
  } catch (error) {
    console.error("Error al confirmar importación:", error);
    return NextResponse.json(
      { error: "Error interno al guardar las facturas." },
      { status: 500 }
    );
  }
}