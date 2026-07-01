import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import type { FacturaExtraida } from "@/lib/extractor";

export const dynamic = 'force-dynamic';

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

    // ============================================================
    // AUTO-MIGRACIÓN ROBUSTA (Self-healing schema)
    // Para entornos portables (el .exe copiado a otro lado con un db viejo)
    // ============================================================
    const columnsToAdd = [
      "clienteCodigo TEXT",
      "clienteDireccion TEXT",
      "clienteCiudadTel TEXT",
      "condicionVenta TEXT",
      "clienteCuit TEXT",
      "clienteContacto TEXT",
      "remito TEXT"
    ];

    for (const colDef of columnsToAdd) {
      try {
        await db.$executeRawUnsafe(`ALTER TABLE Invoice ADD COLUMN ${colDef}`);
        console.log(`[AutoMigrate] Columna agregada: ${colDef}`);
      } catch (e) {
        // Fallará silenciosamente si la columna ya existe, lo cual es el comportamiento deseado.
      }
    }


    let importadas = 0;
    let omitidasFecha = 0;
    const erroresDetalle: string[] = [];

    // ============================================================
    // IMPORTAR TODO LO QUE EL USUARIO SELECCIONÓ.
    // NO decidir nada: sin auto-duplicados, sin auto-nada.
    // Solo se rechaza lo que es imposible de guardar (ej. sin productos).
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
        // FECHA: Aceptamos sin fecha, usando 1970-01-01 como bandera
        // ============================================================
        let fechaEmision: Date;
        const allWarnings: string[] = [];

        if (!fac.fecha) {
          fechaEmision = new Date(0); // 1970 = "Sin fecha"
          allWarnings.push("Sin fecha: no se encontró fecha válida");
        } else {
          const d = new Date(fac.fecha);
          if (isNaN(d.getTime()) || d.getFullYear() < 1990 || d.getFullYear() > 2030) {
            fechaEmision = new Date(0);
            allWarnings.push(`Sin fecha: la fecha encontrada (${fac.fecha}) no es válida o está fuera de rango`);
          } else {
            fechaEmision = d;
          }
        }

        // ============================================================
        // RECOLECTAR ADVERTENCIAS DE TRAZABILIDAD
        // ============================================================
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

        const numeroFinal = String(fac.numero || "").trim();
        const proveedorFinal = String(fac.proveedor || "").trim();

        const dataToSave = {
          tipo: String(fac.tipo || "").trim(),
          fechaEmision,
          total,
          hojaOrigen: String(fac.hoja || "").trim(),
          archivoOrigen: String(fac.archivoOrigen || "").trim(),
          advertencias: advertenciasStr,
          clienteCodigo: String(fac.clienteCodigo || "").trim(),
          clienteDireccion: String(fac.clienteDireccion || "").trim(),
          clienteCiudadTel: String(fac.clienteCiudadTel || "").trim(),
          condicionVenta: String(fac.condicionVenta || "").trim(),
          clienteCuit: String(fac.clienteCuit || "").trim(),
          clienteContacto: String(fac.clienteContacto || "").trim(),
          remito: String(fac.remito || "").trim(),
        };

        const itemsToSave = fac.productos.map((p) => ({
          codigo: String(p.codigo || "").trim(),
          producto: String(p.producto || "").trim(),
          cantidad: safeN(p.cantidad),
          valorUnit: safeN(p.valorUnit),
          subtotal: safeN(p.subtotal),
        }));

        let existingInvoice = null;
        if (numeroFinal) {
          existingInvoice = await db.invoice.findFirst({
            where: { projectId, numero: numeroFinal, proveedor: proveedorFinal },
            include: { items: true }
          });
        }

        if (existingInvoice) {
          // Ya existe: verificar si hubo algún cambio real
          let isDifferent = false;
          if (
            existingInvoice.total !== dataToSave.total ||
            existingInvoice.fechaEmision.getTime() !== dataToSave.fechaEmision.getTime() ||
            existingInvoice.tipo !== dataToSave.tipo ||
            existingInvoice.clienteCodigo !== dataToSave.clienteCodigo ||
            existingInvoice.clienteDireccion !== dataToSave.clienteDireccion ||
            existingInvoice.clienteCiudadTel !== dataToSave.clienteCiudadTel ||
            existingInvoice.condicionVenta !== dataToSave.condicionVenta ||
            existingInvoice.clienteCuit !== dataToSave.clienteCuit ||
            existingInvoice.clienteContacto !== dataToSave.clienteContacto ||
            existingInvoice.remito !== dataToSave.remito ||
            existingInvoice.items.length !== itemsToSave.length
          ) {
            isDifferent = true;
          } else {
            // Comparar items
            for (let i = 0; i < itemsToSave.length; i++) {
              const oldItem = existingInvoice.items[i];
              const newItem = itemsToSave[i];
              if (
                oldItem.codigo !== newItem.codigo ||
                oldItem.producto !== newItem.producto ||
                oldItem.cantidad !== newItem.cantidad ||
                oldItem.valorUnit !== newItem.valorUnit ||
                oldItem.subtotal !== newItem.subtotal
              ) {
                isDifferent = true;
                break;
              }
            }
          }

          if (isDifferent) {
            // Añadir etiqueta ACTUALIZADA a las advertencias
            let parsedWarnings: string[] = [];
            try {
              if (dataToSave.advertencias) parsedWarnings = JSON.parse(dataToSave.advertencias);
            } catch (e) {}
            if (!parsedWarnings.includes("ACTUALIZADA")) {
              parsedWarnings.unshift("ACTUALIZADA");
            }
            const finalAdvertencias = JSON.stringify(parsedWarnings);

            await db.invoice.update({
              where: { id: existingInvoice.id },
              data: {
                ...dataToSave,
                advertencias: finalAdvertencias,
                items: {
                  deleteMany: {}, // Borrar items viejos
                  create: itemsToSave, // Insertar los nuevos
                }
              }
            });
          } else {
            // Son idénticas: omitir silenciosamente (ya está importada)
          }
        } else {
          // No existe: crear nueva
          await db.invoice.create({
            data: {
              projectId,
              numero: numeroFinal,
              proveedor: proveedorFinal,
              ...dataToSave,
              items: {
                create: itemsToSave,
              },
            },
          });
        }
        
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