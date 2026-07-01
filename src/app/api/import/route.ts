import { NextResponse } from "next/server";
import { importarArchivoExcel } from "@/lib/extractor";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archivo = formData.get("archivo");

    if (!archivo || !(archivo instanceof File)) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo." },
        { status: 400 }
      );
    }

    // Validar extensión
    const nombre = archivo.name;
    if (!nombre.match(/\.xlsx$/i)) {
      return NextResponse.json(
        { error: "Solo se aceptan archivos .xlsx" },
        { status: 400 }
      );
    }

    // Validar tamaño (máximo 50MB)
    if (archivo.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "El archivo es demasiado grande (máximo 50MB)." },
        { status: 400 }
      );
    }

    const buffer = await archivo.arrayBuffer();

    // Guardar el archivo en una ubicación temporal para poder abrirlo después en Excel
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const appFolder = path.join(appData, "FacturasApp");
    if (!fs.existsSync(appFolder)) {
      fs.mkdirSync(appFolder, { recursive: true });
    }
    const tempFileName = `temp_import_${Date.now()}.xlsx`;
    const tempFilePath = path.join(appFolder, tempFileName);
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));

    // Pasar el nombre del archivo para trazabilidad
    const resultado = importarArchivoExcel(buffer, nombre);
    
    return NextResponse.json({ ...resultado, tempFileName });
  } catch (error) {
    console.error("Error al importar:", error);
    return NextResponse.json(
      { error: "Error al procesar el archivo. Verificá que sea un .xlsx válido." },
      { status: 500 }
    );
  }
}