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
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });
    }

    // Borrar proyecto (cascade elimina facturas e items)
    await db.project.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar proyecto:", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}