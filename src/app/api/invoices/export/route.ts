import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

const MORADO = "FF6B21A8";
const MORADO_OSCURO = "FF3B0764";
const MORADO_CLARO = "FFF3E8FF";
const GRIS_CLARO = "FFF8F9FA";
const GRIS_BORDE = "FFDEE2E6";
const BLANCO = "FFFFFFFF";
const GRIS_TEXT = "FF6C757D";

const BORDE_NEGRO: Partial<ExcelJS.Borders> = {
  bottom: { style: "thin" as const, color: { argb: "FF000000" } },
  top: { style: "thin" as const, color: { argb: "FF000000" } },
  left: { style: "thin" as const, color: { argb: "FF000000" } },
  right: { style: "thin" as const, color: { argb: "FF000000" } },
};

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
    const format = searchParams.get("format") || "basedatos";

    const where: Record<string, unknown> = {};
    if (projectId) {
      where.projectId = projectId;
    }

    const invoices = await db.invoice.findMany({
      where,
      include: { items: true },
      orderBy: { fechaEmision: "desc" },
    });

    if (format === "original") {
      return exportarFormatoOriginal(invoices);
    }

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
// FORMATO ORIGINAL: cada factura en una hoja con la estructura
// de plantilla que ya conocemos.
// Fila 0: Número de factura (G1)
// Fila 1: Tipo (G2)
// Fila 2: Fecha (G3)
// Fila 3: Proveedor/Cliente (A4)
// Fila 11: Headers (B=CANTIDAD, C=CODIGO, D-F=DESCRIPCION, G=P.UNI, H=TOTAL)
// Filas 12+: Items
// Última fila: TOTAL
// ============================================================
async function exportarFormatoOriginal(invoices: any[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Facturas";
  workbook.created = new Date();

  for (const inv of invoices) {
    // Nombre seguro para la hoja (max 31 chars, sin caracteres especiales)
    const safeName = (inv.numero || "sin-numero")
      .replace(/[\\/*?\[\]:]/g, "-")
      .substring(0, 31);
    const ws = workbook.addWorksheet(safeName);

    // Anchos de columna
    ws.columns = [
      { width: 3 },   // A
      { width: 12 },  // B - CANTIDAD
      { width: 20 },  // C - CODIGO
      { width: 3 },   // D
      { width: 14 },  // E
      { width: 14 },  // F
      { width: 3 },   // G
      { width: 14 },  // G - P.UNI
      { width: 14 },  // H - TOTAL
    ];

    // Fila 1 (row 0): Número de factura — en G1:I1
    ws.mergeCells("G1:I1");
    const c1 = ws.getCell("G1");
    c1.value = inv.numero;
    c1.font = { bold: true, size: 12, name: "Calibri" };
    c1.alignment = { horizontal: "left" };

    // Fila 2 (row 1): Tipo — en G2
    const c2 = ws.getCell("G2");
    c2.value = inv.tipo || "FC";
    c2.font = { size: 10, name: "Calibri" };

    // Fila 3 (row 2): Fecha — en G3
    const c3 = ws.getCell("G3");
    c3.value = new Date(inv.fechaEmision);
    c3.numFmt = "DD/MM/YYYY";
    c3.font = { size: 10, name: "Calibri" };

    // Fila 4 (row 3): Proveedor/Cliente — en A4:F4
    ws.mergeCells("A4:F4");
    const c4 = ws.getCell("A4");
    c4.value = inv.proveedor || "";
    c4.font = { bold: true, size: 11, name: "Calibri" };

    // Fila 9 (row 8): Proveedor repetido (estilo original) — en A9
    ws.getCell("A9").value = inv.proveedor || "";
    ws.getCell("A9").font = { size: 9, name: "Calibri", color: { argb: GRIS_TEXT } };

    // Fila 12 (row 11): Encabezados de items
    const headerRow = 11;
    const headers = [
      { col: "B", label: "CANTIDAD" },
      { col: "C", label: "CODIGO" },
      { col: "D", label: "DESCRIPCION" },
      { col: "G", label: "P.UNI" },
      { col: "H", label: "TOTAL" },
    ];
    for (const h of headers) {
      const cell = ws.getCell(`${h.col}${headerRow}`);
      cell.value = h.label;
      cell.font = { bold: true, size: 10, name: "Calibri" };
      cell.alignment = { horizontal: "center" };
      cell.border = BORDE_NEGRO;
    }

    // Items
    let row = headerRow + 1;
    for (const item of inv.items) {
      // CANTIDAD
      ws.getCell(`B${row}`).value = item.cantidad;
      ws.getCell(`B${row}`).alignment = { horizontal: "right" };
      ws.getCell(`B${row}`).numFmt = "#,##0";
      ws.getCell(`B${row}`).border = BORDE_NEGRO;

      // CODIGO
      ws.getCell(`C${row}`).value = item.codigo || "";
      ws.getCell(`C${row}`).font = { size: 10, name: "Calibri" };
      ws.getCell(`C${row}`).border = BORDE_NEGRO;

      // DESCRIPCION — merge D:F
      ws.mergeCells(`D${row}:F${row}`);
      ws.getCell(`D${row}`).value = item.producto;
      ws.getCell(`D${row}`).font = { size: 10, name: "Calibri" };
      ws.getCell(`D${row}`).border = BORDE_NEGRO;

      // P.UNI
      ws.getCell(`G${row}`).value = item.valorUnit;
      ws.getCell(`G${row}`).alignment = { horizontal: "right" };
      ws.getCell(`G${row}`).numFmt = "#,##0.00";
      ws.getCell(`G${row}`).border = BORDE_NEGRO;

      // TOTAL
      ws.getCell(`H${row}`).value = item.subtotal;
      ws.getCell(`H${row}`).alignment = { horizontal: "right" };
      ws.getCell(`H${row}`).numFmt = "#,##0.00";
      ws.getCell(`H${row}`).border = BORDE_NEGRO;

      row++;
    }

    // Fila TOTAL
    ws.mergeCells(`D${row}:F${row}`);
    ws.getCell(`D${row}`).value = "TOTAL";
    ws.getCell(`D${row}`).font = { bold: true, size: 10, name: "Calibri" };
    ws.getCell(`D${row}`).alignment = { horizontal: "right" };

    ws.getCell(`H${row}`).value = inv.total;
    ws.getCell(`H${row}`).font = { bold: true, size: 10, name: "Calibri" };
    ws.getCell(`H${row}`).alignment = { horizontal: "right" };
    ws.getCell(`H${row}`).numFmt = "#,##0.00";
    ws.getCell(`H${row}`).border = BORDE_NEGRO;
  }

  // Hoja BaseDeDatos al principio
  agregarHojaBaseDeDatos(workbook, invoices);

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Facturas_Original.xlsx"',
    },
  });
}

// ============================================================
// Agregar hoja BaseDeDatos resumida al workbook de formato original
// ============================================================
function agregarHojaBaseDeDatos(workbook: ExcelJS.Workbook, invoices: any[]) {
  // Mover BaseDeDatos al inicio
  const bd = workbook.insertWorksheet(1, "BaseDeDatos", {
    properties: { tabColor: { argb: MORADO } },
  });

  bd.mergeCells("A1:H1");
  const titulo = bd.getCell("A1");
  titulo.value = "BASE DE DATOS - FACTURAS";
  titulo.font = { bold: true, size: 14, color: { argb: BLANCO }, name: "Calibri" };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  bd.getRow(1).height = 36;

  const bdHeaders = ["N° Factura", "Tipo", "Fecha", "Codigo", "Descripcion", "Cantidad", "P.Unitario", "Subtotal"];
  const bdWidths = [20, 7, 13, 12, 45, 11, 14, 14];
  for (let i = 0; i < bdHeaders.length; i++) {
    bd.getColumn(i + 1).width = bdWidths[i];
    const cell = bd.getRow(2).getCell(i + 1);
    cell.value = bdHeaders[i];
    cell.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO_OSCURO } };
    cell.alignment = { horizontal: i >= 5 ? "right" : "left", vertical: "middle" };
    cell.border = BORDE_NEGRO;
  }
  bd.getRow(2).height = 24;

  let bdRow = 3;
  for (const inv of invoices) {
    for (const item of inv.items) {
      bd.getRow(bdRow).getCell(1).value = inv.numero;
      bd.getRow(bdRow).getCell(2).value = inv.tipo || "FC";
      bd.getRow(bdRow).getCell(3).value = formatoFecha(inv.fechaEmision?.toISOString?.() || "");
      bd.getRow(bdRow).getCell(4).value = item.codigo || "";
      bd.getRow(bdRow).getCell(5).value = item.producto;
      bd.getRow(bdRow).getCell(6).value = item.cantidad;
      bd.getRow(bdRow).getCell(7).value = item.valorUnit;
      bd.getRow(bdRow).getCell(8).value = item.subtotal;
      for (let c = 1; c <= 8; c++) {
        const cell = bd.getRow(bdRow).getCell(c);
        cell.font = { size: 10, name: "Calibri" };
        cell.border = BORDE_NEGRO;
        if (c >= 6) cell.numFmt = "#,##0.00";
      }
      bdRow++;
    }
  }
  bd.autoFilter = { from: { row: 2, column: 1 }, to: { row: bdRow - 1, column: 8 } };
  bd.views = [{ state: "frozen", ySplit: 2 }];
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

  // Encabezados
  const headers = [
    "Número de Factura",
    "Fecha de Emisión",
    "Nombre del Cliente",
    "Cantidad",
    "Descripción del Producto",
    "Costo Unitario",
    "Subtotal",
    "Hoja de Origen",
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
    { width: 22, key: "numero" },
    { width: 14, key: "fecha" },
    { width: 35, key: "cliente" },
    { width: 11, key: "cantidad" },
    { width: 45, key: "producto" },
    { width: 15, key: "valorUnit" },
    { width: 15, key: "subtotal" },
    { width: 20, key: "hojaOrigen" },
  ];

  // Datos
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

      row.getCell(4).numFmt = '#,##0';
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '#,##0.00';

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

    const cellCant = totalRow.getCell(4);
    cellCant.value = sumaCantidad;
    cellCant.numFmt = '#,##0';
    cellCant.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cellCant.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    cellCant.alignment = { horizontal: "right", vertical: "middle" };
    aplicarBorde(cellCant, MORADO);

    const cellSub = totalRow.getCell(7);
    cellSub.value = sumaSubtotal;
    cellSub.numFmt = '#,##0.00';
    cellSub.font = { bold: true, size: 10, color: { argb: BLANCO }, name: "Calibri" };
    cellSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
    cellSub.alignment = { horizontal: "right", vertical: "middle" };
    aplicarBorde(cellSub, MORADO);

    for (const c of [1, 2, 3, 5, 6, 8]) {
      const celda = totalRow.getCell(c);
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MORADO } };
      aplicarBorde(celda, MORADO);
    }
  }

  bd.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + rowIndex - 3, column: headers.length },
  };
  bd.views = [{ state: "frozen", ySplit: 3 }];

  // ============================================================
  // HOJA 2: TRAZABILIDAD
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
    row.eachCell((cell) => {
      cell.font = { size: 10, name: "Calibri" };
      aplicarBorde(cell, GRIS_BORDE);
      if (trazaRow % 2 === 0) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
      }
    });

    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(5).alignment = { horizontal: "right" };

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