export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Health-check endpoint.
 * El launcher C# hace polling aquí para confirmar que el servidor Y la base de datos
 * están listos ANTES de abrir el navegador al usuario final.
 * Esto evita el error "client-side exception while loading localhost".
 */
export async function GET() {
  try {
    // Verificar que Prisma puede conectarse a la DB ejecutando una query mínima
    await db.$queryRaw`SELECT 1`;
    
    // Auto-migración robusta para columnas faltantes en custom.db copiado
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
        console.log(`[Health] AutoMigrate: Columna agregada: ${colDef}`);
      } catch (e) {
        // Fallará silenciosamente si ya existe
      }
    }

    return NextResponse.json(
      { status: "ok", db: "connected", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Health] DB not ready:", msg);
    return NextResponse.json(
      { status: "error", db: "disconnected", error: msg },
      { status: 503 }
    );
  }
}
