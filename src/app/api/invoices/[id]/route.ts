import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Factura no encontrada." },
        { status: 404 }
      );
    }

    await db.invoice.delete({ where: { id } });

    return NextResponse.json({ mensaje: "Factura eliminada correctamente." });
  } catch (error) {
    console.error("Error al eliminar factura:", error);
    return NextResponse.json(
      { error: "Error interno al eliminar la factura." },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Factura no encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error al obtener factura:", error);
    return NextResponse.json(
      { error: "Error interno al obtener la factura." },
      { status: 500 }
    );
  }
}