import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await db.invoice.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar factura:", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
