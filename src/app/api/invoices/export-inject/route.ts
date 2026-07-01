import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const MORADO = "FF6B21A8";
const MORADO_OSCURO = "FF3B0764";
const MORADO_CLARO = "FFF3E8FF";
const GRIS_CLARO = "FFF8F9FA";
const GRIS_BORDE = "FFDEE2E6";
const BLANCO = "FFFFFFFF";
const GRIS_TEXT = "FF6C757D";

function aplicarBorde(cell: ExcelJS.Cell, color: string = GRIS_BORDE) {
  cell.border = {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function formatoFecha(isoStr: string): string {
  if (!isoStr) return "SIN FECHA";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "FECHA INVÁLIDA";
  if (d.getFullYear() === 1970) return "SIN FECHA";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const projectId = formData.get("projectId") as string;
    const file = formData.get("file") as File;

    if (!projectId || !file) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    const where: Record<string, unknown> = { projectId };
    const invoices = await db.invoice.findMany({
      where,
      include: { items: true },
      orderBy: { fechaEmision: "desc" },
    });

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const bdExistingIndex = workbook.worksheets.findIndex((ws) => ws.name === "BaseDeDatos");
    if (bdExistingIndex > -1) {
      workbook.removeWorksheet(workbook.worksheets[bdExistingIndex].id);
    }

    const bd = workbook.addWorksheet("BaseDeDatos", {
      properties: { tabColor: { argb: MORADO } },
    });

    const bdIndex = workbook.worksheets.findIndex((ws) => ws.name === "BaseDeDatos");
    if (bdIndex > -1) {
      const removed = workbook.worksheets.splice(bdIndex, 1)[0];
      workbook.worksheets.unshift(removed);
    }

    // Título
    bd.mergeCells("A1:I1");
    const titulo = bd.getCell("A1");
    titulo.value = "BASE DE DATOS - FACTURAS";
    titulo.font = { bold: true, size: 16, color: { argb: BLANCO }, name: "Calibri" };
    titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    titulo.alignment = { horizontal: "center", vertical: "middle" };
    bd.getRow(1).height = 40;

    // Subtítulo
    const totalLineas = invoices.reduce((s: number, i: any) => s + i.items.length, 0);
    bd.mergeCells("A2:I2");
    const subtitulo = bd.getCell("A2");
    subtitulo.value = `Generado el ${formatoFecha(new Date().toISOString())} | ${invoices.length} factura(s) | ${totalLineas} línea(s) de producto`;
    subtitulo.font = { size: 9, color: { argb: GRIS_TEXT }, italic: true, name: "Calibri" };
    subtitulo.alignment = { horizontal: "center", vertical: "middle" };
    subtitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_CLARO } };
    bd.getRow(2).height = 22;

    const headers = [
      "Número de Factura",
      "Fecha de Emisión",
      "Nombre del Cliente",
      "Cantidad de Productos Emitidos",
      "Descripción/Nombre del Producto Emitido",
      "Costo de dicho Producto",
      "",
      "",
      "Hoja de Excel Origen",
    ];

    const headerRow = bd.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber === 7 || colNumber === 8) return;
      cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
      cell.alignment = {
        horizontal: colNumber >= 4 && colNumber <= 6 ? "right" : "left",
        vertical: "middle",
      };
      aplicarBorde(cell, MORADO);
    });

    bd.columns = [
      { width: 22, key: "numero" },
      { width: 14, key: "fecha" },
      { width: 30, key: "cliente" },
      { width: 12, key: "cantidad" },
      { width: 45, key: "producto" },
      { width: 22, key: "valorUnit" },
      { width: 5, key: "vacio1" },
      { width: 5, key: "vacio2" },
      { width: 20, key: "hojaOrigen" },
    ];

    let rowIndex = 3;
    for (const inv of invoices) {
      for (const item of inv.items) {
        let valorUnitExcel: string | number = item.valorUnit;
        if (item.valorUnit === 0) {
          const prodUpper = item.producto.toUpperCase();
          if (prodUpper.includes("CAMBIO")) {
            valorUnitExcel = "CAMBIO";
          } else if (prodUpper.includes("DEVOLUCION") || prodUpper.includes("DEVOLUCIÓN")) {
            valorUnitExcel = "DEVOLUCION";
          } else {
            valorUnitExcel = "SIN CARGO";
          }
        }

        const row = bd.addRow([
          inv.numero,
          formatoFecha(inv.fechaEmision?.toISOString?.() || ""),
          inv.proveedor || "",
          item.cantidad,
          item.producto,
          valorUnitExcel,
          "",
          "",
          inv.hojaOrigen || "",
        ]);

        row.height = 20;
        const esPar = rowIndex % 2 === 0;

        row.eachCell((cell, colNumber) => {
          if (colNumber === 7 || colNumber === 8) return;
          cell.font = { size: 10, name: "Calibri" };
          cell.alignment = {
            horizontal: colNumber >= 4 && colNumber <= 6 ? "right" : "left",
            vertical: "middle",
          };
          aplicarBorde(cell, GRIS_BORDE);

          if (esPar) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
          }
        });

        row.getCell(4).numFmt = '#,##0';
        if (typeof valorUnitExcel === 'number') {
          row.getCell(6).numFmt = '#,##0.00';
        }

        const hojaCell = row.getCell(9);
        hojaCell.font = { size: 9, name: "Calibri", color: { argb: GRIS_TEXT }, italic: true };

        rowIndex++;
      }
    }

    if (invoices.length > 0) {
      const totalRow = bd.addRow(Array(9).fill(""));
      bd.mergeCells(`A${rowIndex}:C${rowIndex}`);
      const totalLabel = bd.getCell(`A${rowIndex}`);
      totalLabel.value = `TOTALES (${rowIndex - 3} líneas de producto)`;
      totalLabel.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      totalLabel.alignment = { horizontal: "right", vertical: "middle" };
      totalRow.height = 26;

      const sumaCantidad = invoices.reduce((s: number, inv: any) =>
        s + inv.items.reduce((si: number, it: any) => si + it.cantidad, 0), 0);

      const cellCant = totalRow.getCell(4);
      cellCant.value = sumaCantidad;
      cellCant.numFmt = '#,##0';
      cellCant.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cellCant.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      cellCant.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellCant, MORADO);

      for (const c of [1, 2, 3, 5, 6, 9]) {
        const celda = totalRow.getCell(c);
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
        aplicarBorde(celda, MORADO);
      }
    }

    bd.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + rowIndex - 3, column: 9 },
    };
    bd.views = [{ state: "frozen", ySplit: 3 }];

    // Retornar el archivo actualizado
    const outputBuffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(outputBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="BaseDeDatos_${file.name}"`,
      },
    });
  } catch (error) {
    console.error("Error al inyectar exportación:", error);
    return NextResponse.json(
      { error: "Error interno al exportar." },
      { status: 500 }
    );
  }
}
