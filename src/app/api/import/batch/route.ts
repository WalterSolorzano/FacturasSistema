import { NextResponse } from "next/server";
import { importarArchivoExcel } from "@/lib/extractor";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

// Límite: 20 archivos por lote
const MAX_FILES = 20;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archivos = formData.getAll("archivos") as File[];

    if (!archivos || archivos.length === 0) {
      return NextResponse.json({ error: "No se recibieron archivos." }, { status: 400 });
    }

    if (archivos.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Máximo ${MAX_FILES} archivos por lote.` },
        { status: 400 }
      );
    }

    // Carpeta temporal para guardar los xlsx
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const appFolder = path.join(appData, "FacturasApp");
    if (!fs.existsSync(appFolder)) fs.mkdirSync(appFolder, { recursive: true });

    const resultadosPorArchivo: {
      nombreArchivo: string;
      carpeta: string;
      facturas: any[];
      exitosas: number;
      conErrores: number;
      vacias: number;
      totalHojas: number;
      tempFileName: string;
    }[] = [];

    for (const [index, archivo] of archivos.entries()) {
      const carpeta = (formData.get(`carpeta_${index}`) as string) || "";

      // Validar extensión
      if (!archivo.name.match(/\.xlsx?$/i)) {
        resultadosPorArchivo.push({
          nombreArchivo: archivo.name,
          carpeta,
          facturas: [],
          exitosas: 0,
          conErrores: 1,
          vacias: 0,
          totalHojas: 0,
          tempFileName: "",
        });
        continue;
      }

      if (archivo.size > 50 * 1024 * 1024) {
        resultadosPorArchivo.push({
          nombreArchivo: archivo.name,
          carpeta,
          facturas: [],
          exitosas: 0,
          conErrores: 1,
          vacias: 0,
          totalHojas: 0,
          tempFileName: "",
        });
        continue;
      }

      try {
        const buffer = await archivo.arrayBuffer();

        // Guardar temp para "Ver en Excel"
        const tempFileName = `temp_lote_${index}_${Date.now()}_${archivo.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const tempFilePath = path.join(appFolder, tempFileName);
        fs.writeFileSync(tempFilePath, Buffer.from(buffer));
        const resultado = importarArchivoExcel(buffer, archivo.name);

        resultadosPorArchivo.push({
          nombreArchivo: archivo.name,
          carpeta,
          tempFileName,
          ...resultado,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[batch] Error procesando ${archivo.name}:`, msg);
        resultadosPorArchivo.push({
          nombreArchivo: archivo.name,
          carpeta: (formData.get(`carpeta_${archivo.name}`) as string) || "",
          facturas: [],
          exitosas: 0,
          conErrores: 1,
          vacias: 0,
          totalHojas: 0,
          tempFileName: "",
        });
      }
    }

    const totalFacturas = resultadosPorArchivo.reduce((s, r) => s + r.exitosas, 0);
    const totalErrores = resultadosPorArchivo.reduce((s, r) => s + r.conErrores, 0);

    return NextResponse.json({
      archivos: resultadosPorArchivo,
      totalArchivos: archivos.length,
      totalFacturas,
      totalErrores,
    });
  } catch (error) {
    console.error("[batch] Error general:", error);
    return NextResponse.json({ error: "Error al procesar el lote." }, { status: 500 });
  }
}
