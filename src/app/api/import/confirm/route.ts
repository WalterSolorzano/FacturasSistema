import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { FacturaExtraida } from "@/lib/extractor";

function safeN(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n) || !isFinite(n)) return 0;
  return n;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { facturas, projectId }: { facturas: FacturaExtraida[]; projectId: string } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "No se especificó el proyecto." },
        { status: 400 }
      );
    }

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

    // Verificar que el proyecto existe
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { error: "El proyecto no existe." },
        { status: 400 }
      );
    }

    let importadas = 0;
    let duplicadas = 0;
    let erroresDetalle: string[] = [];

    for (const fac of exitosas) {
      try {
        // Verificar si ya existe por número dentro del proyecto
        const existente = await db.invoice.findFirst({
          where: { numero: fac.numero, projectId },
        });

        if (existente) {
          duplicadas++;
          continue;
        }

        if (!fac.productos || fac.productos.length === 0) {
          erroresDetalle.push(`${fac.numero}: sin productos`);
          continue;
        }

        let fechaEmision: Date;
        if (fac.fecha) {
          const d = new Date(fac.fecha);
          fechaEmision = isNaN(d.getTime()) ? new Date() : d;
        } else {
          fechaEmision = new Date();
        }

        const total = safeN(fac.total);

        await db.invoice.create({
          data: {
            projectId,
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