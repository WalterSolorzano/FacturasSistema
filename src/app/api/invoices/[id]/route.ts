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
