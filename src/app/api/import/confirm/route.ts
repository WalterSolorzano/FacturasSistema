import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { FacturaExtraida } from "@/lib/extractor";

/**
 * safeN — Convierte un valor a número seguro para Prisma.
 * NUNCA devuelve NaN ni Infinity.
 */
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

    // Verificar que el proyecto existe
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { error: "El proyecto no existe." },
        { status: 400 }
      );
    }

    let importadas = 0;
    let omitidasFecha = 0;
    const erroresDetalle: string[] = [];

    // ============================================================
    // IMPORTAR TODO LO QUE EL USUARIO SELECCIONÓ.
    // NO decidir nada: sin auto-duplicados, sin auto-nada.
    // Solo se rechaza lo que es imposible de guardar (sin fecha, sin productos).
    // ============================================================
    for (const fac of facturas) {
      try {
        // Solo importar las que tienen datos válidos
        if (!fac.exito) {
          erroresDetalle.push(`${fac.numero || fac.hoja}: no se pudo extraer correctamente`);
          continue;
        }

        if (!fac.productos || fac.productos.length === 0) {
          erroresDetalle.push(`${fac.numero}: sin productos`);
          continue;
        }

        // ============================================================
        // FECHA: NO INVENTAR. Si no hay fecha válida, RECHAZAR.
        // ============================================================
        if (!fac.fecha) {
          omitidasFecha++;
          erroresDetalle.push(`${fac.numero}: RECHAZADA — sin fecha válida`);
          continue;
        }

        let fechaEmision: Date;
        const d = new Date(fac.fecha);
        if (isNaN(d.getTime())) {
          omitidasFecha++;
          erroresDetalle.push(`${fac.numero}: RECHAZADA — fecha inválida`);
          continue;
        }
        if (d.getFullYear() < 1990 || d.getFullYear() > 2030) {
          omitidasFecha++;
          erroresDetalle.push(`${fac.numero}: RECHAZADA — fecha fuera de rango (${d.getFullYear()})`);
          continue;
        }
        fechaEmision = d;

        // ============================================================
        // RECOLECTAR ADVERTENCIAS DE TRAZABILIDAD
        // ============================================================
        const allWarnings: string[] = [];

        if (fac._numeroDeHoja) {
          allWarnings.push("Numero tomado del nombre de hoja (no del contenido)");
        }
        if (fac._fechaDudosa) {
          allWarnings.push("Fecha dudosa");
        }
        if (fac.advertencias && fac.advertencias.length > 0) {
          allWarnings.push(...fac.advertencias);
        }

        const total = safeN(fac.total);
        const advertenciasStr = allWarnings.length > 0
          ? JSON.stringify(allWarnings)
          : "";

        await db.invoice.create({
          data: {
            projectId,
            numero: String(fac.numero || "").trim(),
            tipo: String(fac.tipo || "").trim(),
            fechaEmision,
            proveedor: String(fac.proveedor || "").trim(),
            total,
            hojaOrigen: String(fac.hoja || "").trim(),
            archivoOrigen: String(fac.archivoOrigen || "").trim(),
            advertencias: advertenciasStr,
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

    const resumen: string[] = [];
    if (omitidasFecha > 0) {
      resumen.push(`${omitidasFecha} factura(s) rechazada(s) por falta de fecha válida`);
    }

    return NextResponse.json({
      importadas,
      omitidasFecha,
      errores: erroresDetalle,
      resumen,
    });
  } catch (error) {
    console.error("Error al confirmar importación:", error);
    return NextResponse.json(
      { error: "Error interno al guardar las facturas." },
      { status: 500 }
    );
  }
}