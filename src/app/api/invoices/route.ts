import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * safeN — Convierte un valor a número seguro para Prisma.
 * NUNCA devuelve NaN ni Infinity (Prisma los rechaza).
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
    const { numero, tipo, fechaEmision, proveedor, projectId, items } = body;

    if (!numero || !fechaEmision || !projectId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios: numero, fechaEmision, projectId y al menos un producto." },
        { status: 400 }
      );
    }

    // Validar fecha
    const fecha = new Date(fechaEmision);
    if (isNaN(fecha.getTime())) {
      return NextResponse.json(
        { error: "La fecha no es válida." },
        { status: 400 }
      );
    }
    if (fecha.getFullYear() < 1990 || fecha.getFullYear() > 2030) {
      return NextResponse.json(
        { error: "La fecha está fuera de un rango razonable." },
        { status: 400 }
      );
    }

    // Validar items
    const itemsValidos = [];
    let total = 0;

    for (const item of items) {
      const producto = String(item.producto || "").trim();
      if (!producto) continue; // Ignorar items sin descripción

      const cantidad = safeN(item.cantidad);
      const valorUnit = safeN(item.valorUnit);
      const subtotal = Math.round(cantidad * valorUnit * 100) / 100;
      total += subtotal;

      itemsValidos.push({
        codigo: String(item.codigo || "").trim(),
        producto,
        cantidad,
        valorUnit,
        subtotal,
      });
    }

    if (itemsValidos.length === 0) {
      return NextResponse.json(
        { error: "Ningún producto tiene descripción válida." },
        { status: 400 }
      );
    }

    total = Math.round(total * 100) / 100;

    const invoice = await db.invoice.create({
      data: {
        projectId,
        numero: numero.trim(),
        tipo: (tipo || "").trim(),
        fechaEmision: fecha,
        proveedor: (proveedor || "").trim(),
        total,
        // Creación manual: sin trazabilidad de archivo
        hojaOrigen: "creación manual",
        archivoOrigen: "",
        advertencias: "",
        items: {
          create: itemsValidos,
        },
      },
      include: { items: true },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Error al crear factura:", error);
    return NextResponse.json(
      { error: "Error interno al guardar la factura." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const busqueda = searchParams.get("busqueda") || "";
    const desde = searchParams.get("desde") || "";
    const hasta = searchParams.get("hasta") || "";
    const projectId = searchParams.get("projectId") || "";
    const pagina = parseInt(searchParams.get("pagina") || "1");
    const porPagina = parseInt(searchParams.get("porPagina") || "20");

    const where: Record<string, unknown> = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (busqueda) {
      where.OR = [
        { numero: { contains: busqueda } },
        { proveedor: { contains: busqueda } },
        { items: { some: { producto: { contains: busqueda } } } },
      ];
    }

    if (desde || hasta) {
      where.fechaEmision = {};
      if (desde) {
        (where.fechaEmision as Record<string, unknown>).gte = new Date(desde);
      }
      if (hasta) {
        (where.fechaEmision as Record<string, unknown>).lte = new Date(hasta);
      }
    }

    const skip = (pagina - 1) * porPagina;

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: { items: true },
        orderBy: { fechaEmision: "desc" },
        skip,
        take: porPagina,
      }),
      db.invoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices,
      total,
      pagina,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
    });
  } catch (error) {
    console.error("Error al listar facturas:", error);
    return NextResponse.json(
      { error: "Error interno al listar facturas." },
      { status: 500 }
    );
  }
}