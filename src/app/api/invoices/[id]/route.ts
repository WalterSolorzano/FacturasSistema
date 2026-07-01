export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verificar que existe
    const existente = await db.invoice.findUnique({ where: { id } });
    if (!existente) {
      return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });
    }

    // onDelete: Cascade se encarga de borrar los items
    await db.invoice.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar factura:", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      numero, tipo, fechaEmision, proveedor, items,
      clienteCodigo, clienteDireccion, clienteCiudadTel, condicionVenta, clienteCuit, clienteContacto, remito
    } = body;

    const existente = await db.invoice.findUnique({ where: { id } });
    if (!existente) return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });

    const fecha = new Date(fechaEmision);
    const itemsValidos = [];
    let total = 0;
    
    for (const item of items) {
      const producto = String(item.producto || "").trim();
      if (!producto) continue;
      const cantidad = typeof item.cantidad === "number" ? item.cantidad : parseFloat(item.cantidad) || 0;
      const valorUnit = typeof item.valorUnit === "number" ? item.valorUnit : parseFloat(item.valorUnit) || 0;
      const subtotal = Math.round(cantidad * valorUnit * 100) / 100;
      total += subtotal;
      itemsValidos.push({ codigo: String(item.codigo || "").trim(), producto, cantidad, valorUnit, subtotal });
    }

    const updated = await db.invoice.update({
      where: { id },
      data: {
        numero: (numero || "").trim(),
        tipo: (tipo || "").trim(),
        fechaEmision: fecha,
        proveedor: (proveedor || "").trim(),
        clienteCodigo: (clienteCodigo || "").trim(),
        clienteDireccion: (clienteDireccion || "").trim(),
        clienteCiudadTel: (clienteCiudadTel || "").trim(),
        condicionVenta: (condicionVenta || "").trim(),
        clienteCuit: (clienteCuit || "").trim(),
        clienteContacto: (clienteContacto || "").trim(),
        remito: (remito || "").trim(),
        total,
        items: {
          deleteMany: {},
          create: itemsValidos
        }
      }
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error al actualizar:", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
