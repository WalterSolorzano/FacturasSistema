import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { numero, tipo, fechaEmision, proveedor, items } = body;

    if (!numero || !fechaEmision || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios: numero, fechaEmision y al menos un producto." },
        { status: 400 }
      );
    }

    // Calcular el total sumando los subtotales
    let total = 0;
    for (const item of items) {
      const cantidad = parseFloat(item.cantidad) || 0;
      const valorUnit = parseFloat(item.valorUnit) || 0;
      item.subtotal = cantidad * valorUnit;
      total += item.subtotal;
    }

    const invoice = await db.invoice.create({
      data: {
        numero: numero.trim(),
        tipo: (tipo || "").trim(),
        fechaEmision: new Date(fechaEmision),
        proveedor: (proveedor || "").trim(),
        total,
        items: {
          create: items.map((item: Record<string, string | number>) => ({
            codigo: String(item.codigo || "").trim(),
            producto: String(item.producto || "").trim(),
            cantidad: parseFloat(String(item.cantidad)) || 0,
            valorUnit: parseFloat(String(item.valorUnit)) || 0,
            subtotal: parseFloat(String(item.subtotal)) || 0,
          })),
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
    const proveedor = searchParams.get("proveedor") || "";
    const pagina = parseInt(searchParams.get("pagina") || "1");
    const porPagina = parseInt(searchParams.get("porPagina") || "20");

    const where: Record<string, unknown> = {};

    if (busqueda) {
      where.OR = [
        { numero: { contains: busqueda } },
        { proveedor: { contains: busqueda } },
        { items: { some: { producto: { contains: busqueda } } } },
      ];
    }

    if (proveedor) {
      where.proveedor = { contains: proveedor };
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