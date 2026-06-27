import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

const MORADO = "FF6B21A8";
const MORADO_OSCURO = "FF3B0764";
const MORADO_CLARO = "FFF3E8FF";
const GRIS_CLARO = "FFF8F9FA";
const GRIS_BORDE = "FFDEE2E6";
const BLANCO = "FFFFFFFF";
const NEGRO = "FF212529";
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
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = {};
    if (projectId) {
      where.projectId = projectId;
    }

    const invoices = await db.invoice.findMany({
      where,
      include: { items: true },
      orderBy: { fechaEmision: "desc" },
    });

    return exportarBaseDeDatos(invoices);
  } catch (error) {
    console.error("Error al exportar:", error);
    return NextResponse.json(
      { error: "Error interno al exportar." },
      { status: 500 }
    );
  }
}

// ============================================================
// FORMATO BASE DE DATOS — Columnas que pidió el usuario:
// Número de Factura | Fecha de Emisión | Nombre del Cliente |
// Cantidad de Productos Emitidos | Descripción/Nombre del Producto |
// Costo de dicho Producto | (Separado) Identificador de hoja Excel
// ============================================================
async function exportarBaseDeDatos(invoices: any[]) {

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema de Facturas";
    workbook.created = new Date();

    // ============================================================
    // HOJA 1: BASE DE DATOS (formato solicitado por el usuario)
    // ============================================================
    const bd = workbook.addWorksheet("BaseDeDatos", {
      properties: { tabColor: { argb: MORADO } },
    });

    // Título
    bd.mergeCells("A1:H1");
    const titulo = bd.getCell("A1");
    titulo.value = "BASE DE DATOS - FACTURAS";
    titulo.font = { bold: true, size: 16, color: { argb: BLANCO }, name: "Calibri" };
    titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    titulo.alignment = { horizontal: "center", vertical: "middle" };
    bd.getRow(1).height = 40;

    // Subtítulo
    const totalLineas = invoices.reduce((s: number, i: any) => s + i.items.length, 0);
    bd.mergeCells("A2:H2");
    const subtitulo = bd.getCell("A2");
    subtitulo.value = `Generado el ${formatoFecha(new Date().toISOString())} | ${invoices.length} factura(s) | ${totalLineas} línea(s) de producto`;
    subtitulo.font = { size: 9, color: { argb: GRIS_TEXT }, italic: true, name: "Calibri" };
    subtitulo.alignment = { horizontal: "center", vertical: "middle" };
    subtitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_CLARO } };
    bd.getRow(2).height = 22;

    // Encabezados — columnas que pidió el usuario
    const headers = [
      "Número de Factura",
      "Fecha de Emisión",
      "Nombre del Cliente",
      "Cantidad",
      "Descripción del Producto",
      "Costo Unitario",
      "Subtotal",
      "Hoja de Origen",    // Separado como pidió el usuario
    ];

    const headerRow = bd.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
      cell.alignment = {
        horizontal: colNumber >= 4 ? "right" : "left",
        vertical: "middle",
      };
      aplicarBorde(cell, MORADO);
    });

    // Anchos de columna
    bd.columns = [
      { width: 22, key: "numero" },          // Número de Factura
      { width: 14, key: "fecha" },           // Fecha de Emisión
      { width: 35, key: "cliente" },         // Nombre del Cliente
      { width: 11, key: "cantidad" },        // Cantidad
      { width: 45, key: "producto" },        // Descripción del Producto
      { width: 15, key: "valorUnit" },       // Costo Unitario
      { width: 15, key: "subtotal" },        // Subtotal
      { width: 20, key: "hojaOrigen" },      // Hoja de Origen
    ];

    // Datos — una fila por cada línea de producto
    let rowIndex = 3;
    for (const inv of invoices) {
      for (const item of inv.items) {
        const row = bd.addRow([
          inv.numero,
          formatoFecha(inv.fechaEmision?.toISOString?.() || ""),
          inv.proveedor || "",
          item.cantidad,
          item.producto,
          item.valorUnit,
          item.subtotal,
          inv.hojaOrigen || "",
        ]);

        row.height = 20;
        const esPar = rowIndex % 2 === 0;

        row.eachCell((cell, colNumber) => {
          cell.font = { size: 10, name: "Calibri" };
          cell.alignment = {
            horizontal: colNumber >= 4 && colNumber <= 7 ? "right" : "left",
            vertical: "middle",
          };
          aplicarBorde(cell, GRIS_BORDE);

          if (esPar) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
          }
        });

        // Formato numérico
        row.getCell(4).numFmt = '#,##0';
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(7).numFmt = '#,##0.00';

        // Hoja de origen en gris más claro para separarlo visualmente
        const hojaCell = row.getCell(8);
        hojaCell.font = { size: 9, name: "Calibri", color: { argb: GRIS_TEXT }, italic: true };

        rowIndex++;
      }
    }

    // Fila de totales
    if (invoices.length > 0) {
      const totalRow = bd.addRow(Array(8).fill(""));
      bd.mergeCells(`A${rowIndex}:C${rowIndex}`);
      const totalLabel = bd.getCell(`A${rowIndex}`);
      totalLabel.value = `TOTALES (${rowIndex - 3} líneas de producto)`;
      totalLabel.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      totalLabel.alignment = { horizontal: "right", vertical: "middle" };
      totalRow.height = 26;

      const sumaCantidad = invoices.reduce((s: number, inv: any) =>
        s + inv.items.reduce((si: number, it: any) => si + it.cantidad, 0), 0);
      const sumaSubtotal = invoices.reduce((s: number, inv: any) =>
        s + inv.items.reduce((si: number, it: any) => si + it.subtotal, 0), 0);
      const sumaTotal = invoices.reduce((s: number, inv: any) => s + inv.total, 0);

      // Cantidad total
      const cellCant = totalRow.getCell(4);
      cellCant.value = sumaCantidad;
      cellCant.numFmt = '#,##0';
      cellCant.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cellCant.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      cellCant.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellCant, MORADO);

      // Subtotal total
      const cellSub = totalRow.getCell(7);
      cellSub.value = sumaSubtotal;
      cellSub.numFmt = '#,##0.00';
      cellSub.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cellSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      cellSub.alignment = { horizontal: "right", vertical: "middle" };
      aplicarBorde(cellSub, MORADO);

      // Llenar celdas vacías del total row con morado
      for (const c of [1, 2, 3, 5, 6, 8]) {
        const celda = totalRow.getCell(c);
        celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
        aplicarBorde(celda, MORADO);
      }
    }

    // Autofiltro y panel congelado
    bd.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + rowIndex - 3, column: headers.length },
    };
    bd.views = [{ state: "frozen", ySplit: 3 }];

    // ============================================================
    // HOJA 2: TRAZABILIDAD (archivo origen + advertencias)
    // ============================================================
    const traza = workbook.addWorksheet("Trazabilidad", {
      properties: { tabColor: { argb: "FFD97706" } },
    });

    traza.mergeCells("A1:F1");
    const tTitulo = traza.getCell("A1");
    tTitulo.value = "TRAZABILIDAD — ORIGEN DE DATOS";
    tTitulo.font = { bold: true, size: 14, color: { argb: BLANCO }, name: "Calibri" };
    tTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    tTitulo.alignment = { horizontal: "center", vertical: "middle" };
    traza.getRow(1).height = 36;

    const trazaHeaders = [
      "Número de Factura",
      "Archivo Excel",
      "Hoja",
      "Fecha",
      "Total",
      "Advertencias",
    ];
    const trazaHeaderRow = traza.addRow(trazaHeaders);
    trazaHeaderRow.height = 24;
    trazaHeaderRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
      cell.alignment = { horizontal: colNumber === 5 ? "right" : "left", vertical: "middle" };
      aplicarBorde(cell, MORADO);
    });

    traza.columns = [
      { width: 22 },
      { width: 30 },
      { width: 20 },
      { width: 14 },
      { width: 14 },
      { width: 50 },
    ];

    let trazaRow = 2;
    for (const inv of invoices) {
      const row = traza.addRow([
        inv.numero,
        inv.archivoOrigen || "(creación manual)",
        inv.hojaOrigen || "",
        formatoFecha(inv.fechaEmision?.toISOString?.() || ""),
        inv.total,
        inv.advertencias || "",
      ]);

      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.font = { size: 10, name: "Calibri" };
        aplicarBorde(cell, GRIS_BORDE);
        if (trazaRow % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
        }
      });

      // Formato
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(5).alignment = { horizontal: "right" };

      // Advertencias en naranja
      if (inv.advertencias) {
        row.getCell(6).font = { size: 9, name: "Calibri", color: { argb: "FFB45309" } };
      }

      trazaRow++;
    }

    traza.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: trazaRow - 1, column: 6 },
    };
    traza.views = [{ state: "frozen", ySplit: 2 }];

    // ============================================================
    // GENERAR
    // ============================================================
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="BaseDeDatos.xlsx"',
      },
    });
}