import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { FacturaExtraida } from "@/lib/extractor";

// Sanitiza un valor numérico: NaN/null/undefined/Infinity → 0
function safeN(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n) || !isFinite(n)) return 0;
  return n;
}

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
        if (!fac.productos || fac.productos.length === 0) {
          erroresDetalle.push(`${fac.numero}: sin productos`);
          continue;
        }

        // Sanitizar fecha
        let fechaEmision: Date;
        if (fac.fecha) {
          const d = new Date(fac.fecha);
          fechaEmision = isNaN(d.getTime()) ? new Date() : d;
        } else {
          fechaEmision = new Date();
        }

        // Sanitizar total de la factura
        const total = safeN(fac.total);

        await db.invoice.create({
          data: {
            numero: String(fac.numero || "").trim(),
            tipo: String(fac.tipo || "").trim(),
            fechaEmision,
            proveedor: String(fac.proveedor || "").trim(),
            total,
            items: {
              create: fac.productos.map((p) => ({
                codigo: String(p.codigo || "").trim(),
                producto: String(p.producto || "").trim(),
                cantidad: safeN(p.cantidad),
                valorUnit: safeN(p.valorUnit),
                subtotal: safeN(p.subtotal),
              })),
            },
          },
        });
        importadas++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Error guardando ${fac.numero}:`, msg);
        erroresDetalle.push(`${fac.numero}: ${msg}`);
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