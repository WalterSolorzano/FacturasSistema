import { NextResponse } from "next/server";
import { importarArchivoExcel } from "@/lib/extractor";

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

    const buffer = await archivo.arrayBuffer();

    const resultado = importarArchivoExcel(buffer);

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Error al importar:", error);
    return NextResponse.json(
      { error: "Error al procesar el archivo. Verificá que sea un .xlsx válido." },
      { status: 500 }
    );
  }
}