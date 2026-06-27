import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/import/existing?projectId=xxx&numeros=FC001,FC002,...
 * Devuelve los números que ya existen en el proyecto.
 * Solo informativo — el usuario decide qué hacer.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const numerosStr = searchParams.get("numeros") || "";

    if (!projectId || !numerosStr) {
      return NextResponse.json({ existentes: [] });
    }

    const numeros = numerosStr.split(",").map((n) => n.trim()).filter(Boolean);
    if (numeros.length === 0) {
      return NextResponse.json({ existentes: [] });
    }

    const existentes = await db.invoice.findMany({
      where: {
        projectId,
        numero: { in: numeros },
      },
      select: { numero: true, fechaEmision: true, total: true, proveedor: true },
    });

    return NextResponse.json({ existentes });
  } catch (error) {
    console.error("Error al verificar existentes:", error);
    return NextResponse.json({ existentes: [] });
  }
}