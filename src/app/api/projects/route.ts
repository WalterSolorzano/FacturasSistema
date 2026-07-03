export const dynamic = 'force-dynamic';
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { invoices: true } } },
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error al listar proyectos:", error);
    return NextResponse.json(
      { error: "Error interno." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: "Ingresá un nombre para el proyecto." },
        { status: 400 }
      );
    }

    const project = await db.project.create({
      data: { nombre: nombre.trim() },
    });

    // Añadir el contador artificial para evitar crash en el frontend si espera este campo
    const projectWithCount = {
      ...project,
      _count: { invoices: 0 }
    };

    return NextResponse.json(projectWithCount, { status: 201 });
  } catch (error) {
    console.error("Error al crear proyecto:", error);
    return NextResponse.json(
      { error: "Error interno al crear proyecto." },
      { status: 500 }
    );
  }
}