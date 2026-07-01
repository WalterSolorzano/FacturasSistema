export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

function escapeVbsString(value: string): string {
  return value.replace(/"/g, '""');
}

export async function POST(request: Request) {
  try {
    const { sheetName, tempFileName } = await request.json();

    if (!sheetName) {
      return NextResponse.json({ error: "Falta el nombre de la hoja" }, { status: 400 });
    }

    const fileName = tempFileName || "temp_import.xlsx";
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const appFolder = path.join(appData, "FacturasApp");
    const tempFilePath = path.join(appFolder, fileName);
    const safeFileName = escapeVbsString(fileName);
    const safeTempFilePath = escapeVbsString(tempFilePath);
    const safeSheetName = escapeVbsString(sheetName);

    // Construimos un script temporal de VBScript para abrir Excel en esa hoja
    // Usar PowerShell puede ser muy lento, VBScript es extremadamente rápido para COM objects
    const vbsPath = path.join(appFolder, "open_sheet.vbs");
    const vbsContent = `
On Error Resume Next
Set objExcel = GetObject(, "Excel.Application")
If Err.Number <> 0 Then
    Set objExcel = CreateObject("Excel.Application")
End If
Err.Clear
On Error GoTo 0

objExcel.Visible = True

' Buscar si el archivo ya está abierto
Dim isOpen
isOpen = False
For Each wb In objExcel.Workbooks
  If LCase(wb.Name) = LCase("${safeFileName}") Then
        Set objWorkbook = wb
        isOpen = True
        Exit For
    End If
Next

If Not isOpen Then
  Set objWorkbook = objExcel.Workbooks.Open("${safeTempFilePath}")
End If

' Intentar activar la hoja
On Error Resume Next
Set objWorksheet = objWorkbook.Sheets("${safeSheetName}")
objWorksheet.Activate
On Error GoTo 0

' Traer la ventana al frente
objExcel.WindowState = -4143 ' xlNormal
objExcel.Visible = True
objExcel.AppActivate
    `;

    // Escribimos el script
    fs.writeFileSync(vbsPath, vbsContent);

    // Lo ejecutamos (sin bloquear la respuesta)
    exec(`cscript //nologo "${vbsPath}"`, (error) => {
      if (error) {
        console.error("Error abriendo Excel:", error);
      }
      try {
        if (fs.existsSync(vbsPath)) {
          fs.unlinkSync(vbsPath);
        }
      } catch {
        // Ignorar si ya fue eliminado
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error en open-excel:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
